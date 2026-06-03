#!/bin/bash
# Deterministic validators run after the judges pass and before publish.
# Each check is independently testable and logs its own pass/fail line.
#
# Checks:
#   1. em-dash count must be 0
#   2. forbidden-phrase lint must be clean
#   3. [VERIFY] markers must be 0
#   4. all internal hrefs must use / base path
#   5. npm run build must succeed when this draft replaces the live page
#
# Usage:
#   . tools/curator/lib/validate.sh
#   validate_draft <draft.astro> <candidate.json>
#   # exits 0 on all-pass, 1 if any check failed

_VALIDATE_SELF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURATOR_DIR="$( cd "$_VALIDATE_SELF_DIR/.." && pwd )"
WEBSITE_ROOT="$( cd "$CURATOR_DIR/../.." && pwd )"
export CURATOR_DIR

[ -z "${CURATOR_LOG:-}" ] && {
    . "$_VALIDATE_SELF_DIR/log.sh"
}

# Source forbidden_check too (we reuse it below)
[ "$(type -t forbidden_check)" = "function" ] || . "$_VALIDATE_SELF_DIR/forbidden_check.sh"

BASE_PATH="${BASE_PATH:-/}"

# 1. em-dash check (no — anywhere in the draft)
validate_em_dash() {
    local draft="$1"
    local count
    # Use wc -l on grep output; safe whether or not matches exist.
    count=$(grep -- "—" "$draft" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -eq 0 ]; then
        log_info "validate_em_dash: clean (0 em-dashes)"
        return 0
    else
        log_error "validate_em_dash: $count em-dash(es) present"
        grep -n -- "—" "$draft" | head -5 >&2
        return 1
    fi
}

# 2. forbidden phrases (delegate to lib/forbidden_check.sh)
validate_forbidden() {
    local draft="$1"
    forbidden_check "$draft" "$CURATOR_DIR/forbidden_phrases.txt"
}

# 3. [VERIFY] markers (none allowed in the final draft)
validate_no_verify_markers() {
    local draft="$1"
    local count
    count=$(grep "\[VERIFY" "$draft" 2>/dev/null | wc -l | tr -d ' ')
    if [ "$count" -eq 0 ]; then
        log_info "validate_no_verify_markers: clean"
        return 0
    else
        log_error "validate_no_verify_markers: $count [VERIFY] marker(s) present"
        grep -n "\[VERIFY" "$draft" | head -5 >&2
        return 1
    fi
}

# 4. base path check on all internal hrefs
# Internal href: starts with / but not protocol, not anchor.
# Must include BASE_PATH at the start.
validate_base_path() {
    local draft="$1"
    # Extract all href="/..." values and check each
    local bad
    bad=$(grep -oE 'href="(/[^"#][^"]*)"' "$draft" \
        | sed -E 's|^href="||; s|"$||' \
        | grep -v "^${BASE_PATH%/}" || true)
    if [ -z "$bad" ]; then
        log_info "validate_base_path: clean"
        return 0
    else
        log_error "validate_base_path: hrefs missing base path:"
        echo "$bad" | head -5 | sed 's/^/  /' >&2
        return 1
    fi
}

# 5. build check (replaces live page with draft, runs npm build, restores)
# Requires the candidate JSON to identify the target path.
validate_build() {
    local draft="$1"
    local candidate="$2"

    local id type
    id=$(python3 -c "import json; print(json.load(open('$candidate'))['id'])")
    type=$(python3 -c "import json; print(json.load(open('$candidate'))['type'])")

    local target_dir
    case "$type" in
        report) target_dir="src/pages/reports" ;;
        note)   target_dir="src/pages/notes" ;;
        *) log_error "validate_build: unknown type: $type"; return 1 ;;
    esac

    local target_path="${WEBSITE_ROOT}/${target_dir}/${id}.astro"
    local backup=""

    # Backup if file exists; otherwise mark "new" so we delete on cleanup.
    # Each step has explicit error handling — a silent backup failure here
    # would mean the live page gets clobbered by the draft and never
    # restored if build fails.
    local was_new=0
    if [ -f "$target_path" ]; then
        # macOS mktemp requires X's at END of template (incident 2026-05-26).
        local _backup_base
        _backup_base=$(mktemp /tmp/validate_build_backup.XXXXXX)
        backup="${_backup_base}.astro"
        mv "$_backup_base" "$backup" 2>/dev/null
        if [ -z "$backup" ] || [ ! -f "$backup" ]; then
            log_error "validate_build: could not create backup tempfile; REFUSING to proceed (would risk clobbering live page)"
            return 1
        fi
        if ! cp "$target_path" "$backup"; then
            log_error "validate_build: backup cp failed for $target_path; REFUSING to proceed"
            rm -f "$backup"
            return 1
        fi
        # Verify the backup is non-empty and matches source size
        if [ ! -s "$backup" ]; then
            log_error "validate_build: backup is empty; REFUSING to proceed"
            rm -f "$backup"
            return 1
        fi
    else
        was_new=1
    fi

    # Place draft as the target. Explicit error: if cp fails, restore + bail.
    if ! cp "$draft" "$target_path"; then
        log_error "validate_build: could not copy draft to $target_path"
        if [ "$was_new" -eq 0 ] && [ -n "$backup" ]; then
            cp "$backup" "$target_path"
            rm -f "$backup"
        fi
        return 1
    fi

    # Run build
    local build_log
    build_log=$(mktemp /tmp/validate_build_log.XXXXXX)
    (cd "$WEBSITE_ROOT" && npm run build > "$build_log" 2>&1)
    local rc=$?

    # Restore
    if [ "$was_new" -eq 1 ]; then
        rm -f "$target_path"
    elif [ -n "$backup" ]; then
        cp "$backup" "$target_path"
        rm -f "$backup"
    fi

    if [ $rc -eq 0 ]; then
        log_info "validate_build: build succeeded"
        rm -f "$build_log"
        return 0
    else
        log_error "validate_build: build FAILED"
        tail -20 "$build_log" >&2
        rm -f "$build_log"
        return 1
    fi
}

# validate_draft <draft> <candidate>
# Runs all 5 checks; returns 0 if all pass, 1 if any failed.
validate_draft() {
    local draft="$1"
    local candidate="$2"
    if [ ! -f "$draft" ]; then
        log_error "validate_draft: draft missing: $draft"
        return 2
    fi
    if [ ! -f "$candidate" ]; then
        log_error "validate_draft: candidate missing: $candidate"
        return 2
    fi

    log_section "validating: $(basename "$draft")"

    local fails=0
    validate_em_dash "$draft" || fails=$((fails+1))
    validate_forbidden "$draft" || fails=$((fails+1))
    validate_no_verify_markers "$draft" || fails=$((fails+1))
    validate_base_path "$draft" || fails=$((fails+1))
    validate_build "$draft" "$candidate" || fails=$((fails+1))

    if [ "$fails" -eq 0 ]; then
        log_info "validate_draft: all 5 checks PASSED"
        return 0
    else
        log_warn "validate_draft: $fails check(s) FAILED"
        return 1
    fi
}
