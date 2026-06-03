#!/bin/bash
# LinkedIn teaser generator. Single narrow LLM call.
# Reads the published Astro page, extracts prose (stripping markup),
# generates a 200-300 word teaser via Claude --print, validates basic
# constraints, writes to channel_drafts/linkedin/<id>.txt.
#
# Does NOT auto-post to LinkedIn. The operator copy-pastes when ready.
# (LinkedIn API is restrictive; manual post + automated draft is the
# right shape.)

_LI_SELF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURATOR_DIR="$( cd "$_LI_SELF_DIR/.." && pwd )"
WEBSITE_ROOT="$( cd "$CURATOR_DIR/../.." && pwd )"
export CURATOR_DIR

[ -z "${CURATOR_LOG:-}" ] && {
    . "$_LI_SELF_DIR/log.sh"
}

SITE_BASE_URL="${SITE_BASE_URL:-https://harshithkantamneni.github.io}"

# Extract prose from an Astro page. Strips JSX tags, frontmatter, JSX
# expressions, and astro-cid attributes.
_extract_prose() {
    local astro_file="$1"
    ASTRO_FILE="$astro_file" python3 <<'PYEOF'
import os, re
text = open(os.environ['ASTRO_FILE']).read()
# Strip frontmatter (first --- block)
text = re.sub(r'^---\n[\s\S]*?\n---\n?', '', text, count=1)
# Strip JSX comment blocks {/* ... */}
text = re.sub(r'\{/\*[\s\S]*?\*/\}', '', text)
# Strip JSX expression blocks {...}
text = re.sub(r'\{[^{}]*?\}', '', text)
# Strip HTML/JSX tags
text = re.sub(r'<[^>]+>', ' ', text)
# Normalize whitespace
text = re.sub(r'[ \t]+', ' ', text)
text = re.sub(r'\n\s*\n', '\n\n', text)
print(text.strip())
PYEOF
}

# channel_linkedin <candidate.json> [astro_override] [out_override]
# Default: reads from WEBSITE_ROOT/src/pages/{reports,notes}/<id>.astro
#          writes to CURATOR_DIR/channel_drafts/linkedin/<id>.txt
# If [astro_override] is given, read source from there (used during review
# staging when the draft hasn't been moved into src/pages/ yet).
# If [out_override] is given, write paste-ready file there instead.
channel_linkedin() {
    local candidate="$1"
    local astro_override="${2:-}"
    local out_override="${3:-}"
    if [ ! -f "$candidate" ]; then
        log_error "channel_linkedin: candidate missing: $candidate"
        return 1
    fi

    # Read all fields in a single python call via env var (safe against
    # apostrophes or other quote chars in field values).
    local id type title summary
    {
        read -r id
        read -r type
        read -r title
        read -r summary
    } < <(CANDIDATE="$candidate" python3 <<'PYEOF'
import os, json
d = json.load(open(os.environ['CANDIDATE']))
print(d['id'])
print(d['type'])
print(d['title'])
print(d.get('summary', ''))
PYEOF
)

    # Resolve the published Astro file to extract prose from
    local subpath astro_path target_url
    case "$type" in
        report) subpath="reports" ;;
        note)   subpath="notes" ;;
        *) log_error "channel_linkedin: unknown type: $type"; return 1 ;;
    esac
    if [ -n "$astro_override" ]; then
        astro_path="$astro_override"
    else
        astro_path="${WEBSITE_ROOT}/src/pages/${subpath}/${id}.astro"
    fi
    target_url="${SITE_BASE_URL}/${subpath}/${id}"

    if [ ! -f "$astro_path" ]; then
        log_error "channel_linkedin: published Astro file missing: $astro_path"
        return 1
    fi

    log_info "channel_linkedin: extracting prose from $astro_path"
    local prose
    prose=$(_extract_prose "$astro_path")
    if [ -z "$prose" ]; then
        log_error "channel_linkedin: extracted prose is empty"
        return 1
    fi

    # Build narrow prompt (voice anchor + extracted prose + URL — no
    # source artifacts, no forbidden phrases, no JSON metadata clutter).
    local voice_md="$CURATOR_DIR/voice/linkedin.md"
    if [ ! -f "$voice_md" ]; then
        log_error "channel_linkedin: voice anchor missing: $voice_md"
        return 1
    fi

    local prompt
    prompt=$(VOICE_PATH="$voice_md" TITLE="$title" URL="$target_url" TYPE="$type" PROSE="$prose" python3 <<'PYEOF'
import os
template = open(os.environ['CURATOR_DIR'] + '/prompts/channel_linkedin.txt').read()
voice = open(os.environ['VOICE_PATH']).read()
print(
    template
    .replace('{{VOICE_MD}}', voice)
    .replace('{{TITLE}}', os.environ['TITLE'])
    .replace('{{URL}}', os.environ['URL'])
    .replace('{{TYPE}}', os.environ['TYPE'])
    .replace('{{PROSE}}', os.environ['PROSE'])
)
PYEOF
)

    log_info "channel_linkedin: prompt $(echo -n "$prompt" | wc -c) chars; calling claude --print --model opus"

    # Single narrow Claude call.
    local teaser rc
    teaser=$(echo "$prompt" | claude --print --model opus --dangerously-skip-permissions 2>/dev/null)
    rc=$?

    if [ $rc -ne 0 ] || [ -z "$teaser" ]; then
        log_error "channel_linkedin: claude failed (rc=$rc)"
        return 1
    fi

    # Validate: 200-300 words, no em-dashes, no obvious cargo-cult.
    local word_count em_dashes
    word_count=$(echo "$teaser" | wc -w | tr -d ' ')
    em_dashes=$(echo "$teaser" | grep -- "—" | wc -l | tr -d ' ')

    if [ "$em_dashes" -gt 0 ]; then
        log_warn "channel_linkedin: $em_dashes em-dash(es) present; flagged but not blocking"
    fi
    if [ "$word_count" -lt 150 ] || [ "$word_count" -gt 350 ]; then
        log_warn "channel_linkedin: word count $word_count is outside 150-350 range; flagged but not blocking"
    fi

    # Forbidden phrase check — delegate to the word-boundary helper
    # (which properly filters comments and blank lines from the phrase file).
    [ "$(type -t forbidden_check)" = "function" ] || . "$CURATOR_DIR/lib/forbidden_check.sh"
    # macOS mktemp requires X's at END of template (incident 2026-05-26).
    local teaser_tmpfile _teaser_base
    _teaser_base=$(mktemp /tmp/linkedin_teaser.XXXXXX)
    teaser_tmpfile="${_teaser_base}.txt"
    mv "$_teaser_base" "$teaser_tmpfile"
    echo "$teaser" > "$teaser_tmpfile"
    local forbidden_hits=0
    if ! forbidden_check "$teaser_tmpfile" "$CURATOR_DIR/forbidden_phrases.txt" 2>/dev/null; then
        # forbidden_check returns nonzero if hits found; count by re-grepping log
        forbidden_hits=$(forbidden_check "$teaser_tmpfile" "$CURATOR_DIR/forbidden_phrases.txt" 2>&1 | grep -c "HIT:")
    fi
    rm -f "$teaser_tmpfile"
    if [ "$forbidden_hits" -gt 0 ]; then
        log_warn "channel_linkedin: $forbidden_hits forbidden-phrase hit(s); flagged but not blocking"
    fi

    # Write output file with metadata header
    local out_file
    if [ -n "$out_override" ]; then
        out_file="$out_override"
    else
        out_file="${CURATOR_DIR}/channel_drafts/linkedin/${id}.txt"
    fi
    mkdir -p "$(dirname "$out_file")"

    cat > "$out_file" <<EOF
LINKEDIN TEASER (paste-ready)
=============================

ID:          ${id}
Type:        ${type}
URL:         ${target_url}
Word count:  ${word_count}
Em-dashes:   ${em_dashes}
Forbidden:   ${forbidden_hits}

──────── post body below ────────

${teaser}

──────── end ────────

Operator notes:
- Paste the post body (between the dashed lines) into LinkedIn's compose box.
- LinkedIn truncates at the first ~210 characters in feed. Verify the hook lands in that window.
- LinkedIn discourages link-only posts. The CTA at the end is correct shape.
- Posting timing: weekday 8-10am local time tends to outperform other windows for technical content.
EOF

    log_info "channel_linkedin: teaser written to $out_file (${word_count} words)"
    return 0
}
