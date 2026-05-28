#!/bin/bash
# Curator orchestrator — daily entrypoint.
# Reads new manifest entries from each lab's publish_candidates/ dir,
# runs each through the full pipeline (classify → draft → judge →
# validate → provenance → publish-by-tier), and logs the result.
#
# Usage:
#   bash tools/curator/run.sh           # full run
#   CURATOR_DEBUG=1 bash tools/curator/run.sh   # extra logging
#   bash tools/curator/run.sh --skip-ram-check  # bypass RAM precondition
#   DRY_RUN=1 bash tools/curator/run.sh         # log what would happen, don't push

# Strict mode. -e halts on any unhandled command failure; -u catches
# unset variables; pipefail catches errors anywhere in a pipe.
# This is critical: without -e, a failed python3 inside the manifest-update
# steps below would silently let the candidate proceed to the next stage.
set -euo pipefail

CURATOR_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
WEBSITE_ROOT="$( cd "$CURATOR_DIR/../.." && pwd )"
export CURATOR_DIR

. "$CURATOR_DIR/lib/log.sh"
. "$CURATOR_DIR/lib/ram_check.sh"
. "$CURATOR_DIR/lib/forbidden_check.sh"
. "$CURATOR_DIR/lib/classify.sh"
. "$CURATOR_DIR/lib/draft.sh"
. "$CURATOR_DIR/lib/judge.sh"
. "$CURATOR_DIR/lib/validate.sh"
. "$CURATOR_DIR/lib/provenance.sh"
. "$CURATOR_DIR/lib/publish.sh"
. "$CURATOR_DIR/lib/channel_hackernews.sh"
. "$CURATOR_DIR/lib/channel_linkedin.sh"
. "$CURATOR_DIR/lib/channel_buttondown.sh"

SKIP_RAM_CHECK=0
for arg in "$@"; do
    case "$arg" in
        --skip-ram-check) SKIP_RAM_CHECK=1 ;;
        *) log_warn "unknown arg: $arg" ;;
    esac
done

on_exit() {
    local code=$?
    if [ "$code" -ne 0 ]; then
        log_error "curator run FAILED with exit code $code"
    else
        log_section "curator run end (exit 0)"
    fi
    exit "$code"
}
trap on_exit EXIT

# ── Stage 0: RAM precondition ───────────────────────────────────────────
log_section "stage 0: RAM precondition"
if [ "$SKIP_RAM_CHECK" -eq 0 ]; then
    if ! ram_check 12; then
        log_warn "RAM tight; deferring this run."
        exit 0
    fi
else
    log_info "ram_check skipped (--skip-ram-check)"
fi

# ── Stage 1: scan manifests ─────────────────────────────────────────────
log_section "stage 1: scan manifests"

HIVE_MANIFEST_DIR="$HOME/Desktop/Fun/lab/publish_candidates"
AGI_MANIFEST_DIR="$HOME/Desktop/AGI/data/publish_candidates"

# Stuck-state recovery: a previous run that crashed mid-pipeline leaves
# the candidate in 'processing' with no follow-up. Reset any candidate
# stuck in 'processing' for > STUCK_THRESHOLD_HOURS to 'held' so the
# operator notices and decides whether to retry.
STUCK_THRESHOLD_HOURS="${STUCK_THRESHOLD_HOURS:-2}"
STUCK_RESET_COUNT=0
for dir in "$HIVE_MANIFEST_DIR" "$AGI_MANIFEST_DIR"; do
    [ -d "$dir" ] || continue
    for f in "$dir"/*.json; do
        [ -f "$f" ] || continue
        RESET_LINE=$(CANDIDATE="$f" THRESHOLD_H="$STUCK_THRESHOLD_HOURS" python3 <<'PYEOF' 2>/dev/null
import os, json, datetime
p = os.environ['CANDIDATE']
threshold_h = float(os.environ['THRESHOLD_H'])
try:
    d = json.load(open(p))
except Exception:
    print(''); raise SystemExit(0)
if d.get('curator_state') != 'processing':
    print(''); raise SystemExit(0)
started = d.get('processing_started_at')
age_h = None
if started:
    try:
        t = datetime.datetime.fromisoformat(started)
        age_h = (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() / 3600
    except Exception:
        age_h = None
# No timestamp OR older than threshold → reset.
if age_h is None or age_h >= threshold_h:
    d['curator_state'] = 'held'
    d['held_reason'] = (f"previous run interrupted (was 'processing' for "
                        f"{age_h:.1f}h)" if age_h is not None else
                        "previous run interrupted (no processing_started_at; "
                        "pre-2026-05-12 manifest)")
    d.pop('processing_started_at', None)
    open(p, 'w').write(json.dumps(d, indent=2))
    print(f"reset {os.path.basename(p)} (age={age_h if age_h is not None else 'unknown'})")
else:
    print('')
PYEOF
)
        if [ -n "$RESET_LINE" ]; then
            log_warn "stuck-state recovery: $RESET_LINE"
            STUCK_RESET_COUNT=$((STUCK_RESET_COUNT + 1))
        fi
    done
done
if [ "$STUCK_RESET_COUNT" -gt 0 ]; then
    log_warn "stuck-state recovery: reset $STUCK_RESET_COUNT candidate(s) → 'held'; review with cli.sh held"
fi

# Find all candidates with curator_state == "pending"
CANDIDATES=()
for dir in "$HIVE_MANIFEST_DIR" "$AGI_MANIFEST_DIR"; do
    if [ -d "$dir" ]; then
        for f in "$dir"/*.json; do
            [ -f "$f" ] || continue
            STATE=$(python3 -c "import json; print(json.load(open('$f')).get('curator_state', 'pending'))" 2>/dev/null)
            if [ "$STATE" = "pending" ]; then
                CANDIDATES+=("$f")
            fi
        done
    fi
done

log_info "found ${#CANDIDATES[@]} pending candidate(s)"

if [ "${#CANDIDATES[@]}" -eq 0 ]; then
    log_info "no new candidates → exit clean"
    exit 0
fi

# ── Per-candidate pipeline ──────────────────────────────────────────────
for candidate in "${CANDIDATES[@]}"; do
    log_section "candidate: $(basename "$candidate")"
    START_EPOCH=$(date +%s)

    # Mark as processing (in-place edit; reverts on hold/fail).
    # processing_started_at lets the next run's stuck-state recovery
    # detect candidates abandoned by a crashed previous run.
    CANDIDATE="$candidate" python3 <<'PYEOF'
import os, json, datetime
p = os.environ['CANDIDATE']
d = json.load(open(p))
d['curator_state'] = 'processing'
d['processing_started_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
open(p, 'w').write(json.dumps(d, indent=2))
PYEOF

    # Stage 2: classify risk
    log_section "stage 2: classify risk"
    TIER=""
    CLASSIFY_RC=0
    # Run classifier; capture both its stdout (the tier number) and its
    # exit code so we can distinguish infra-failure (rc=3) from
    # successful classification.
    set +e
    TIER=$(classify_candidate "$candidate" 2>&1 | tail -1)
    CLASSIFY_RC=$?
    set -e
    if [ "$CLASSIFY_RC" -eq 3 ]; then
        # Infrastructure failure: MLX itself broken (model load, OOM, etc).
        # Do NOT silently default to Tier 1 — that's the failure mode.
        # Hold the candidate so the operator notices the broken infra.
        log_error "stage 2: classifier reported INFRASTRUCTURE failure. NOT defaulting to Tier 1."
        log_error "stage 2: holding candidate so the operator notices the broken infra."
        python3 -c "
import json
d = json.load(open('$candidate'))
d['curator_state'] = 'held'
d['held_reason'] = 'classifier infrastructure failure (MLX call rc=3); fix MLX before re-running'
open('$candidate','w').write(json.dumps(d, indent=2))
"
        continue
    fi
    if [ -z "$TIER" ] || ! [[ "$TIER" =~ ^[123]$ ]]; then
        log_warn "stage 2: classifier returned non-numeric ('$TIER'); model output ambiguous; safe-defaulting to Tier 1"
        TIER=1
    fi
    # Update manifest with tier
    python3 -c "
import json
d = json.load(open('$candidate'))
d['risk_tier'] = $TIER
open('$candidate','w').write(json.dumps(d, indent=2))
"
    log_info "candidate tier: $TIER"

    # Stage 3: draft
    log_section "stage 3: draft via claude --print"
    # macOS mktemp requires X's at the END of the template; suffixes after
    # X's are treated as literal. Create-then-rename pattern (incident
    # 2026-05-26: literal `/tmp/curator_draft.XXXXXX.astro` collided across
    # runs because mktemp didn't substitute the X's).
    _draft_base=$(mktemp /tmp/curator_draft.XXXXXX) || { log_error "mktemp failed"; continue; }
    DRAFT_PATH="${_draft_base}.astro"
    mv "$_draft_base" "$DRAFT_PATH"
    if ! draft_candidate "$candidate" > "$DRAFT_PATH"; then
        log_error "drafting failed; marking candidate held"
        python3 -c "
import json
d = json.load(open('$candidate'))
d['curator_state'] = 'held'
d['held_reason'] = 'drafting failed'
open('$candidate','w').write(json.dumps(d, indent=2))
"
        rm -f "$DRAFT_PATH"
        continue
    fi

    # Stage 4: judges
    log_section "stage 4: judges"
    _judges_base=$(mktemp /tmp/curator_judges.XXXXXX) || { log_error "mktemp failed"; continue; }
    JUDGES_OUT="${_judges_base}.json"
    mv "$_judges_base" "$JUDGES_OUT"
    if ! judge_draft "$DRAFT_PATH" "$candidate" > "$JUDGES_OUT"; then
        HELD_REASON=$(python3 -c "import json; print(json.load(open('$JUDGES_OUT')).get('held_reason', 'judges held'))")
        log_warn "judges held the draft: $HELD_REASON"
        python3 -c "
import json
d = json.load(open('$candidate'))
d['curator_state'] = 'held'
d['held_reason'] = '''$HELD_REASON'''
d['scores'] = json.load(open('$JUDGES_OUT'))
open('$candidate','w').write(json.dumps(d, indent=2))
"
        rm -f "$DRAFT_PATH" "$JUDGES_OUT"
        continue
    fi
    log_info "judges: PASS"

    # Stage 5: provenance
    log_section "stage 5: provenance"
    NOW_EPOCH=$(date +%s)
    COST_SECONDS=$((NOW_EPOCH - START_EPOCH))
    JUDGES_JSON=$(cat "$JUDGES_OUT")
    inject_provenance "$DRAFT_PATH" "$candidate" "$JUDGES_JSON" "$COST_SECONDS"

    # Stage 6: validate
    log_section "stage 6: validate"
    if ! validate_draft "$DRAFT_PATH" "$candidate"; then
        log_warn "validators held the draft"
        python3 -c "
import json
d = json.load(open('$candidate'))
d['curator_state'] = 'held'
d['held_reason'] = 'validators failed'
open('$candidate','w').write(json.dumps(d, indent=2))
"
        rm -f "$DRAFT_PATH" "$JUDGES_OUT"
        continue
    fi

    # Stage 7: stage for review (NOT publish — operator approves via dashboard)
    # The draft is moved to pending_drafts/, the candidate is marked
    # 'awaiting_review', and the run loop continues to the next candidate.
    # Approval (running publish_draft + channel adapters) happens via
    # approve.sh, invoked by the dashboard's approve button.
    log_section "stage 7: stage for review"
    CANDIDATE_ID=$(CANDIDATE="$candidate" python3 -c "import os, json; print(json.load(open(os.environ['CANDIDATE']))['id'])")
    PENDING_DRAFT="${CURATOR_DIR}/pending_drafts/${CANDIDATE_ID}.astro"
    PENDING_JUDGES="${CURATOR_DIR}/pending_drafts/${CANDIDATE_ID}.judges.json"
    mkdir -p "${CURATOR_DIR}/pending_drafts"
    cp "$DRAFT_PATH" "$PENDING_DRAFT"
    cp "$JUDGES_OUT" "$PENDING_JUDGES"
    CANDIDATE="$candidate" PENDING_DRAFT="$PENDING_DRAFT" TIER="$TIER" \
    COST_SECONDS="$COST_SECONDS" python3 <<'PYEOF'
import os, json, datetime
p = os.environ['CANDIDATE']
d = json.load(open(p))
d['curator_state'] = 'awaiting_review'
d['pending_draft'] = os.environ['PENDING_DRAFT']
d['awaiting_review_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
d['risk_tier'] = int(os.environ['TIER'])
d['cost_seconds'] = int(os.environ['COST_SECONDS'])
d.pop('processing_started_at', None)
open(p, 'w').write(json.dumps(d, indent=2))
PYEOF
    # Pre-generate channel drafts so the operator can review them
    # alongside the main draft. HN is instant (deterministic); LinkedIn
    # adds a Claude call (~60s) but is worth previewing before approval.
    CHANNELS=$(CANDIDATE="$candidate" python3 -c "import os, json; print(' '.join(json.load(open(os.environ['CANDIDATE'])).get('channels', ['website'])))" 2>/dev/null || echo "website")
    for ch in $CHANNELS; do
        case "$ch" in
            website) ;;
            hackernews)
                channel_hackernews "$candidate" \
                    "${CURATOR_DIR}/pending_drafts/${CANDIDATE_ID}.hackernews.txt" \
                    || log_warn "channel_hackernews pre-gen failed (non-blocking)"
                ;;
            linkedin)
                channel_linkedin "$candidate" "$PENDING_DRAFT" \
                    "${CURATOR_DIR}/pending_drafts/${CANDIDATE_ID}.linkedin.txt" \
                    || log_warn "channel_linkedin pre-gen failed (non-blocking)"
                ;;
            buttondown)
                # Preview only at staging — real API call happens at approve.
                channel_buttondown_render "$candidate" \
                    "${CURATOR_DIR}/pending_drafts/${CANDIDATE_ID}.buttondown.txt" \
                    || log_warn "channel_buttondown preview failed (non-blocking)"
                ;;
        esac
    done

    log_info "candidate $(basename "$candidate") → awaiting_review (tier $TIER, ${COST_SECONDS}s); review via cli.sh ui"
    rm -f "$DRAFT_PATH" "$JUDGES_OUT"
done

log_info "all candidates processed"
