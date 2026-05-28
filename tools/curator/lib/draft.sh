#!/bin/bash
# Drafting wrapper. Builds the prompt from voice anchor + forbidden list +
# candidate metadata + source content, invokes claude --print --model opus,
# returns the draft on stdout.
#
# Usage:
#   . tools/curator/lib/draft.sh
#   draft_candidate path/to/candidate.json > /tmp/draft.astro

# Always resolve from this script's location.
_DRAFT_SELF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURATOR_DIR="$( cd "$_DRAFT_SELF_DIR/.." && pwd )"
export CURATOR_DIR

[ -z "${CURATOR_LOG:-}" ] && {
    . "$_DRAFT_SELF_DIR/log.sh"
}

# draft_candidate <candidate_json_path>
# Outputs: the .astro draft to stdout
# Exits nonzero on failure
draft_candidate() {
    local candidate="$1"
    if [ ! -f "$candidate" ]; then
        log_error "draft_candidate: candidate file missing: $candidate"
        return 1
    fi

    # Extract metadata
    local lab type title summary
    lab=$(python3 -c "import json; print(json.load(open('$candidate'))['lab'])")
    type=$(python3 -c "import json; print(json.load(open('$candidate'))['type'])")
    title=$(python3 -c "import json; print(json.load(open('$candidate'))['title'])")
    summary=$(python3 -c "import json; print(json.load(open('$candidate'))['summary'])")

    log_info "draft_candidate: lab=$lab type=$type title=$title"

    # Resolve voice anchor
    local voice_md="$CURATOR_DIR/voice/${lab}.md"
    if [ ! -f "$voice_md" ]; then
        log_error "draft_candidate: voice anchor missing: $voice_md"
        return 1
    fi

    # Resolve source artifacts. Each entry can be a string (same-lab) or
    # an object {lab, path}. Concatenate all source contents with markers.
    local sources_content
    sources_content=$(python3 -c "
import json, os, sys

c = json.load(open('$candidate'))
artifacts = c['source_artifacts']

# Lab roots
ROOTS = {
    'hive': os.path.expanduser('~/Desktop/Fun/lab'),
    'agi':  os.path.expanduser('~/Desktop/AGI'),
}
own_lab = c['lab']

parts = []
for sa in artifacts:
    if isinstance(sa, str):
        # Strip anchor if present (#section)
        path_part = sa.split('#')[0]
        full = os.path.join(ROOTS[own_lab], path_part)
    elif isinstance(sa, dict):
        full = os.path.join(ROOTS[sa['lab']], sa['path'])
    else:
        sys.exit(f'unknown source_artifact shape: {sa}')

    if not os.path.exists(full):
        sys.exit(f'source artifact missing: {full}')

    # Skip binary asset extensions — they're referenced for provenance /
    # figure inclusion, not as text source for drafting. Reading them as
    # UTF-8 crashes (e.g., PDFs have 0xac in their header). Manifest still
    # records the artifact link; drafter just doesn't try to extract text.
    BINARY_EXTS = {'.pdf', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg',
                   '.ico', '.zip', '.tar', '.gz', '.mp4', '.webm', '.mp3',
                   '.wav', '.ttf', '.woff', '.woff2'}
    ext = os.path.splitext(full)[1].lower()
    if ext in BINARY_EXTS:
        parts.append(f'--- SOURCE: {full} ---\n[binary asset, {ext} — referenced for provenance only]\n')
        continue

    # Read text sources; tolerate occasional non-UTF-8 bytes in otherwise-
    # text files by replacing them rather than crashing the whole draft.
    try:
        with open(full, encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        with open(full, encoding='utf-8', errors='replace') as f:
            content = f.read()
    parts.append(f'--- SOURCE: {full} ---\n{content}\n')

print('\n\n'.join(parts))
")

    if [ -z "$sources_content" ]; then
        log_error "draft_candidate: no source content extracted"
        return 1
    fi

    log_info "draft_candidate: source content $(echo -n "$sources_content" | wc -c) chars from $(echo -n "$sources_content" | grep -c '^--- SOURCE:') file(s)"

    # Write sources_content to a temp file rather than inlining via bash
    # heredoc — embedded Python files commonly contain triple-quoted
    # docstrings + non-ASCII chars (e.g., §, σ), and bash interpolation
    # into a Python heredoc breaks out of the outer string and corrupts
    # the script. File-based passing is invariant under content shape.
    local sources_tmp
    sources_tmp=$(mktemp -t curator-sources-XXXXXX) || { log_error "mktemp failed"; return 1; }
    printf '%s' "$sources_content" > "$sources_tmp"

    # Build prompt by substituting placeholders. All inputs read from
    # files; nothing interpolated into the Python source.
    local prompt
    prompt=$(SOURCES_TMP="$sources_tmp" \
             CURATOR_DIR_ENV="$CURATOR_DIR" \
             VOICE_MD_ENV="$voice_md" \
             CANDIDATE_ENV="$candidate" \
             python3 <<'PYEOF'
import json, os
curator_dir = os.environ['CURATOR_DIR_ENV']
template = open(os.path.join(curator_dir, 'prompts/draft.txt'), encoding='utf-8').read()
voice = open(os.environ['VOICE_MD_ENV'], encoding='utf-8').read()
forbidden = open(os.path.join(curator_dir, 'forbidden_phrases.txt'), encoding='utf-8').read()
candidate_json = open(os.environ['CANDIDATE_ENV'], encoding='utf-8').read()
with open(os.environ['SOURCES_TMP'], encoding='utf-8', errors='replace') as f:
    sources = f.read()

# Note: candidate's type is filtered into the {{TYPE}} marker.
candidate_type = json.loads(candidate_json)['type']

prompt = template \
    .replace('{{VOICE_MD}}', voice) \
    .replace('{{FORBIDDEN_LIST}}', forbidden) \
    .replace('{{CANDIDATE_JSON}}', candidate_json) \
    .replace('{{SOURCE_CONTENT}}', sources) \
    .replace('{{TYPE}}', candidate_type)

print(prompt)
PYEOF
)
    rm -f "$sources_tmp"

    if [ -z "$prompt" ]; then
        log_error "draft_candidate: failed to build prompt"
        return 1
    fi

    log_info "draft_candidate: prompt $(echo -n "$prompt" | wc -c) chars; calling claude --print --model opus"

    # Invoke claude. --print for non-interactive, --model opus, --effort max
    # to match the labs' settings, --dangerously-skip-permissions for
    # autonomous operation. Pass prompt via stdin to avoid argv length limits.
    local draft
    draft=$(echo "$prompt" | claude --print --model opus --effort max --dangerously-skip-permissions 2>/dev/null)
    local rc=$?

    if [ $rc -ne 0 ] || [ -z "$draft" ]; then
        log_error "draft_candidate: claude invocation failed (rc=$rc)"
        return 1
    fi

    # Strip any preamble/postamble outside the actual Astro content.
    # The draft should start with `---` (frontmatter) and end with `</Default>`.
    draft=$(echo "$draft" | python3 -c "
import sys, re
text = sys.stdin.read()
# Find first ---
m_start = re.search(r'^---\s*$', text, re.MULTILINE)
m_end = re.search(r'</Default>\s*$', text, re.MULTILINE)
if m_start and m_end:
    text = text[m_start.start():m_end.end()]
print(text)
")

    log_info "draft_candidate: draft $(echo -n "$draft" | wc -c) chars"
    echo "$draft"
    return 0
}
