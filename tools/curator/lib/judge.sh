#!/bin/bash
# PoLL panel of three judges run sequentially on a draft.
# - Voice judge: 14B Coder, vs voice anchor
# - Factcheck judge: 7B, vs source artifacts
# - Novelty judge: 7B, vs already-published corpus
#
# Sequential to keep peak RAM ≤ 9GB. Each judge spawns its own MLX subprocess
# (model unloads between calls, RAM frees).
#
# Usage:
#   . tools/curator/lib/judge.sh
#   judge_draft <draft.astro> <candidate.json>
#   # writes scores to draft's sidecar; returns 0 if all judges pass.

_JUDGE_SELF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURATOR_DIR="$( cd "$_JUDGE_SELF_DIR/.." && pwd )"
export CURATOR_DIR

[ -z "${CURATOR_LOG:-}" ] && {
    . "$_JUDGE_SELF_DIR/log.sh"
}

VOICE_MODEL="${VOICE_MODEL:-mlx-community/Qwen2.5-Coder-14B-Instruct-4bit}"
FACT_MODEL="${FACT_MODEL:-mlx-community/Qwen2.5-7B-Instruct-4bit}"
NOVELTY_MODEL="${NOVELTY_MODEL:-mlx-community/Qwen2.5-7B-Instruct-4bit}"

VOICE_THRESHOLD="${VOICE_THRESHOLD:-6.5}"
NOVELTY_THRESHOLD="${NOVELTY_THRESHOLD:-6.0}"

# Run an MLX call, extract the JSON payload from output.
_run_judge_mlx() {
    local model="$1"
    local prompt="$2"
    local max_tokens="${3:-512}"
    local raw
    raw=$(mlx_lm.generate \
        --model "$model" \
        --prompt "$prompt" \
        --max-tokens "$max_tokens" \
        --temp 0.1 \
        2>/dev/null | sed -n '/^==========$/,/^==========$/p' | sed '1d;$d')
    # Some MLX outputs wrap JSON in ```json fences; strip them
    echo "$raw" | python3 -c "
import sys, re, json
text = sys.stdin.read()
# Try to find JSON by braces
m = re.search(r'\{[\s\S]*\}', text)
if not m:
    sys.exit('no JSON found')
candidate = m.group(0)
try:
    parsed = json.loads(candidate)
    print(json.dumps(parsed))
except Exception as e:
    sys.exit(f'JSON parse error: {e}\\nraw: {candidate[:200]}')
"
}

# judge_voice <draft_path> <candidate_json>
# echoes JSON {"score": N, "rationale": "..."}
judge_voice() {
    local draft="$1"
    local candidate="$2"
    local lab
    lab=$(python3 -c "import json; print(json.load(open('$candidate'))['lab'])")
    local voice_md="$CURATOR_DIR/voice/${lab}.md"

    log_info "judge_voice: model=$VOICE_MODEL"

    local prompt
    prompt=$(python3 <<PYEOF
template = open('$CURATOR_DIR/prompts/judge_voice.txt').read()
voice = open('$voice_md').read()
draft = open('$draft').read()
print(template.replace('{{VOICE_MD}}', voice).replace('{{DRAFT}}', draft))
PYEOF
)

    _run_judge_mlx "$VOICE_MODEL" "$prompt" 256
}

# judge_factcheck <draft_path> <candidate_json>
# Deterministic implementation. Tests verified on the design that LLM-based
# per-claim factcheck (7B) over-flags valid claims (false-positive rate too
# high to be useful). The actual failure mode we need to catch is NUMBER
# hallucination ("twelfth" -> "fifteenth"). That's deterministic.
#
# Algorithm:
# - Extract all numeric tokens from the draft (digits, percentages, written
#   numbers one through twenty)
# - Extract all numeric tokens from the source
# - Any draft number not in source = unverified (potential hallucination)
# - Any [VERIFY] marker = unverified
#
# Returns JSON in the same shape as the LLM version did.
judge_factcheck() {
    local draft="$1"
    local candidate="$2"

    log_info "judge_factcheck: deterministic numeric check"

    python3 <<PYEOF
import json, os, re

candidate = json.load(open('$candidate'))
artifacts = candidate['source_artifacts']
ROOTS = {
    'hive': os.path.expanduser('~/Desktop/Fun/lab'),
    'agi':  os.path.expanduser('~/Desktop/AGI'),
}
own_lab = candidate['lab']

# Read sources — skip binary asset extensions (PDFs, images, etc.) and
# tolerate occasional non-UTF-8 bytes in otherwise-text files.
BINARY_EXTS = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
               '.ico', '.zip', '.tar', '.gz', '.mp4', '.webm', '.mp3',
               '.wav', '.ttf', '.woff', '.woff2'}
source_text = ""
for sa in artifacts:
    if isinstance(sa, str):
        full = os.path.join(ROOTS[own_lab], sa.split('#')[0])
    else:
        full = os.path.join(ROOTS[sa['lab']], sa['path'])
    if not os.path.exists(full):
        continue
    if os.path.splitext(full)[1].lower() in BINARY_EXTS:
        continue
    try:
        source_text += open(full, encoding='utf-8').read() + "\n"
    except UnicodeDecodeError:
        source_text += open(full, encoding='utf-8', errors='replace').read() + "\n"

# Read draft
draft_text = open('$draft', encoding='utf-8').read()

# Strip Astro tags from draft so we only check the prose
prose = re.sub(r'<[^>]+>', ' ', draft_text)
prose = re.sub(r'---[\s\S]*?---', '', prose, count=1)

# Number extraction: digits with optional comma separators, optional decimal,
# optional unit suffix (s, ms, km, m, kg, %, etc).
# Captures the bare number in group 1.
num_pattern = re.compile(r'\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)(?:s|ms|km|kg|m|g|%|pp|GB|MB|KB|TB|kB|kbps|Mbps|fps|hz|kHz|MHz|GHz)?\b', re.IGNORECASE)

# Word numbers we treat as numerals
word_to_num = {
    'one':1,'two':2,'three':3,'four':4,'five':5,'six':6,'seven':7,'eight':8,
    'nine':9,'ten':10,'eleven':11,'twelve':12,'thirteen':13,'fourteen':14,
    'fifteen':15,'sixteen':16,'seventeen':17,'eighteen':18,'nineteen':19,'twenty':20,
    'twelfth':12,'fifteenth':15,'tenth':10,'thirtieth':30,
    'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90,
    'hundred':100,'thousand':1000,'million':1000000
}

def normalize_number_token(t):
    """Strip commas, return canonical numeric form."""
    t = t.replace(',', '').strip()
    return t

def extract_numbers(text):
    """Extract all numeric tokens from a text. Strips unit suffixes for matching."""
    s = set()
    # Numerals (with optional unit, captured without the unit)
    for m in num_pattern.findall(text):
        s.add(normalize_number_token(m))
    # Word numbers
    for w in word_to_num:
        if re.search(r'\b' + w + r'\b', text, re.IGNORECASE):
            s.add(str(word_to_num[w]))
    return s

draft_numbers = extract_numbers(prose)
source_numbers = extract_numbers(source_text)

# Verify draft numbers against source. A draft number is unverified only if the
# source has no exact, percent<->proportion, or rounding-compatible twin — so a
# faithful "0.0601 -> 6.01%" conversion passes while a hallucinated value is
# still caught. See lib/factcheck_numbers.py + tests/test_factcheck_numbers.py.
import sys
sys.path.insert(0, os.path.join(os.environ['CURATOR_DIR'], 'lib'))
from factcheck_numbers import compute_unverified
unverified_numbers = compute_unverified(draft_numbers, source_numbers)

# Also catch [VERIFY] markers
verify_markers = re.findall(r'\[VERIFY[^\]]*\]', draft_text)

# Build human-readable unverified list (with surrounding context for each number)
unverified_with_context = []
for n in unverified_numbers:
    # Find the number in prose with ~30 chars context
    pattern = r'.{0,40}\b' + re.escape(n) + r'\b.{0,40}'
    m = re.search(pattern, prose, re.IGNORECASE)
    if m:
        unverified_with_context.append(f"'{n}' in: ...{m.group(0).strip()}...")
    else:
        unverified_with_context.append(f"'{n}'")

for marker in verify_markers:
    unverified_with_context.append(f"[VERIFY] marker: {marker}")

# Pass = all draft numbers also in source AND no [VERIFY] markers
pass_check = (len(unverified_numbers) == 0) and (len(verify_markers) == 0)

result = {
    "pass": pass_check,
    "verified_count": len(draft_numbers - set(unverified_numbers)),
    "draft_numbers_total": len(draft_numbers),
    "unverified": unverified_with_context
}
print(json.dumps(result, indent=2))
PYEOF
}

# judge_novelty <draft_path> <candidate_json>
judge_novelty() {
    local draft="$1"
    local candidate="$2"
    local own_id
    own_id=$(python3 -c "import json; print(json.load(open('$candidate'))['id'])")

    log_info "judge_novelty: model=$NOVELTY_MODEL"

    # Build corpus from already-published backfill entries (excluding self)
    local corpus
    corpus=$(python3 <<PYEOF
import json, os
own_id = '$own_id'
parts = []
for f in sorted(os.listdir('$CURATOR_DIR/backfill')):
    if not f.endswith('.json'): continue
    d = json.load(open(f'$CURATOR_DIR/backfill/{f}'))
    if d.get('curator_state') != 'published': continue
    if d['id'] == own_id: continue
    parts.append(f"- id: {d['id']}\n  title: {d['title']}\n  summary: {d['summary']}\n")
print('\n'.join(parts))
PYEOF
)

    local prompt
    prompt=$(python3 <<PYEOF
template = open('$CURATOR_DIR/prompts/judge_novelty.txt').read()
draft = open('$draft').read()
print(template.replace('{{DRAFT}}', draft).replace('{{CORPUS}}', """$corpus"""))
PYEOF
)

    _run_judge_mlx "$NOVELTY_MODEL" "$prompt" 384
}

# judge_draft <draft_path> <candidate_json>
# Runs all three judges, aggregates results, decides hold/proceed.
# Echoes a final JSON payload with all scores.
# Returns 0 if pass, 1 if any judge held the draft.
judge_draft() {
    local draft="$1"
    local candidate="$2"
    if [ ! -f "$draft" ]; then
        log_error "judge_draft: draft missing: $draft"
        return 2
    fi
    if [ ! -f "$candidate" ]; then
        log_error "judge_draft: candidate missing: $candidate"
        return 2
    fi

    log_section "judging draft: $(basename "$draft")"

    local voice_json fact_json novelty_json
    voice_json=$(judge_voice "$draft" "$candidate") || { log_error "voice judge failed"; return 2; }
    fact_json=$(judge_factcheck "$draft" "$candidate") || { log_error "factcheck judge failed"; return 2; }
    novelty_json=$(judge_novelty "$draft" "$candidate") || { log_error "novelty judge failed"; return 2; }

    local voice_score fact_pass novelty_score held_reason
    voice_score=$(echo "$voice_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('score', 0))")
    fact_pass=$(echo "$fact_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('pass', False))")
    novelty_score=$(echo "$novelty_json" | python3 -c "import json,sys; print(json.load(sys.stdin).get('score', 0))")

    log_info "voice_score=$voice_score (threshold $VOICE_THRESHOLD)"
    log_info "factcheck_pass=$fact_pass"
    log_info "novelty_score=$novelty_score (threshold $NOVELTY_THRESHOLD)"

    local pass=true
    held_reason=""
    if (( $(echo "$voice_score < $VOICE_THRESHOLD" | bc -l) )); then
        pass=false
        held_reason="voice judge: $voice_score below threshold $VOICE_THRESHOLD"
    fi
    if [ "$fact_pass" != "True" ]; then
        pass=false
        held_reason="${held_reason:+$held_reason; }factcheck judge: unverified claims present"
    fi
    if (( $(echo "$novelty_score < $NOVELTY_THRESHOLD" | bc -l) )); then
        pass=false
        held_reason="${held_reason:+$held_reason; }novelty judge: $novelty_score below threshold $NOVELTY_THRESHOLD (likely duplicates published piece)"
    fi

    # Emit aggregate result. Convert bash booleans to Python via string match.
    local pass_py
    if [ "$pass" = "true" ]; then pass_py="True"; else pass_py="False"; fi
    python3 <<PYEOF
import json
result = {
    'pass': $pass_py,
    'voice': json.loads('''$voice_json'''),
    'factcheck': json.loads('''$fact_json'''),
    'novelty': json.loads('''$novelty_json'''),
    'held_reason': '''$held_reason'''
}
print(json.dumps(result, indent=2))
PYEOF

    if [ "$pass" = "true" ]; then
        log_info "judges: PASS"
        return 0
    else
        log_warn "judges: HELD ($held_reason)"
        return 1
    fi
}
