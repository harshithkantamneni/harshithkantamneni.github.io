#!/bin/bash
# Buttondown channel: per-piece draft email.
#
# Two entry points:
#
#   channel_buttondown_render <candidate.json> <out_path>
#     Renders the email markdown to <out_path>. No API call. Used during
#     Stage 7 review staging so the operator can preview what would go
#     out before approving.
#
#   channel_buttondown <candidate.json> [astro_override] [out_override]
#     Real API call. POSTs the email to Buttondown as status=draft.
#     Writes an audit file with the email-id + Buttondown review URL.
#     Used by approve.sh after the operator green-lights the piece.
#
# Reads token from $WEBSITE_ROOT/.env (BUTTONDOWN_API_TOKEN). Operator
# reviews + sends in Buttondown's UI; we never auto-send.

_BD_SELF_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
CURATOR_DIR="$( cd "$_BD_SELF_DIR/.." && pwd )"
WEBSITE_ROOT="$( cd "$CURATOR_DIR/../.." && pwd )"

[ -z "${CURATOR_LOG:-}" ] && {
    . "$_BD_SELF_DIR/log.sh"
}

SITE_BASE_URL="${SITE_BASE_URL:-https://harshithkantamneni.github.io}"


# Internal: extract id/type/title/summary/lab + build email body markdown.
# Echoes JSON {id, target_url, subject, body} on success; returns 1 on bad input.
_buttondown_build() {
    local candidate="$1"
    if [ ! -f "$candidate" ]; then
        return 1
    fi
    CANDIDATE="$candidate" SITE_BASE_URL="$SITE_BASE_URL" python3 <<'PYEOF'
import os, json, sys
d = json.load(open(os.environ['CANDIDATE']))
typ = d.get('type', '')
subpath = {'report': 'reports', 'note': 'notes'}.get(typ)
if not subpath:
    sys.stderr.write(f"channel_buttondown: unknown type: {typ}\n")
    sys.exit(1)
id_     = d.get('id', '')
title   = d.get('title', '')
summary = d.get('summary', '')
lab     = (d.get('lab', '') or '').upper()
url     = f"{os.environ['SITE_BASE_URL']}/{subpath}/{id_}"
meta_bits = []
if typ:
    meta_bits.append('**Type:** ' + typ)
if lab:
    meta_bits.append('**Lab:** ' + lab)
meta_line = '  ·  '.join(meta_bits)
body = f"""**[{title}]({url})**

> {summary}

{meta_line}

[Read the full piece →]({url})

---

*You're receiving this because you subscribed to the monthly digest.
Reply directly with thoughts; one-click unsubscribe is in the footer.*"""
print(json.dumps({
    'id': id_, 'target_url': url, 'subject': title, 'body': body,
}))
PYEOF
}


channel_buttondown_render() {
    local candidate="$1"
    local out_file="$2"
    if [ -z "$out_file" ]; then
        log_error "channel_buttondown_render: out_file required"
        return 1
    fi
    local built
    built=$(_buttondown_build "$candidate") || {
        log_error "channel_buttondown_render: build failed"
        return 1
    }
    mkdir -p "$(dirname "$out_file")"
    BUILT="$built" OUT="$out_file" python3 <<'PYEOF'
import os, json
d = json.loads(os.environ['BUILT'])
open(os.environ['OUT'], 'w').write(f"""BUTTONDOWN DRAFT (preview — not yet sent to Buttondown)
=======================================================

This is the email markdown that will be POSTed to Buttondown as a draft
WHEN you click 'approve & publish'. Edit in Buttondown's UI before sending.

Subject:      {d['subject']}
Target URL:   {d['target_url']}

──────── body ────────

{d['body']}

──────── end ────────
""")
PYEOF
    log_info "channel_buttondown_render: preview written to $out_file"
    return 0
}


channel_buttondown() {
    local candidate="$1"
    # astro_override unused (Buttondown doesn't read prose from the Astro
    # file; the body is built from manifest fields). Kept for adapter
    # signature consistency.
    local _astro_override="${2:-}"
    local out_override="${3:-}"

    if [ -f "$WEBSITE_ROOT/.env" ]; then
        # shellcheck disable=SC1091
        . "$WEBSITE_ROOT/.env"
    fi
    if [ -z "${BUTTONDOWN_API_TOKEN:-}" ]; then
        log_error "channel_buttondown: BUTTONDOWN_API_TOKEN not set in .env"
        return 1
    fi

    local built
    built=$(_buttondown_build "$candidate") || {
        log_error "channel_buttondown: build failed"
        return 1
    }

    local id subject body target_url
    id=$(BUILT="$built"      python3 -c "import os, json; print(json.loads(os.environ['BUILT'])['id'])")
    subject=$(BUILT="$built" python3 -c "import os, json; print(json.loads(os.environ['BUILT'])['subject'])")
    body=$(BUILT="$built"    python3 -c "import os, json; print(json.loads(os.environ['BUILT'])['body'])")
    target_url=$(BUILT="$built" python3 -c "import os, json; print(json.loads(os.environ['BUILT'])['target_url'])")

    # POST to Buttondown as a draft.
    local body_file http_code
    body_file=$(mktemp /tmp/bd_resp.XXXXXX)
    http_code=$(SUBJECT="$subject" BODY="$body" TOKEN="$BUTTONDOWN_API_TOKEN" \
                BODY_FILE="$body_file" python3 <<'PYEOF'
import os, json, urllib.request, urllib.error
data = json.dumps({
    'subject': os.environ['SUBJECT'],
    'body':    os.environ['BODY'],
    'status':  'draft',
}).encode('utf-8')
req = urllib.request.Request(
    'https://api.buttondown.com/v1/emails',
    data=data,
    headers={
        'Authorization': 'Token ' + os.environ['TOKEN'],
        'Content-Type': 'application/json',
    },
    method='POST',
)
try:
    with urllib.request.urlopen(req, timeout=20) as r:
        open(os.environ['BODY_FILE'], 'wb').write(r.read())
        print(r.status)
except urllib.error.HTTPError as e:
    open(os.environ['BODY_FILE'], 'wb').write(e.read())
    print(e.code)
except Exception as e:
    open(os.environ['BODY_FILE'], 'w').write(str(e))
    print('-1')
PYEOF
)

    if [ "$http_code" != "200" ] && [ "$http_code" != "201" ]; then
        log_error "channel_buttondown: POST failed (HTTP $http_code)"
        log_error "  response: $(head -c 400 "$body_file")"
        rm -f "$body_file"
        return 1
    fi

    local email_id
    email_id=$(BODY_FILE="$body_file" python3 -c "
import os, json
try:
    d = json.load(open(os.environ['BODY_FILE']))
    print(d.get('id', ''))
except Exception:
    print('')
" 2>/dev/null)
    rm -f "$body_file"

    local out_file
    if [ -n "$out_override" ]; then
        out_file="$out_override"
    else
        out_file="${CURATOR_DIR}/channel_drafts/buttondown/${id}.txt"
    fi
    mkdir -p "$(dirname "$out_file")"
    cat > "$out_file" <<EOF
BUTTONDOWN DRAFT (created via API)
==================================

Status:       draft (NOT yet sent — review + send in Buttondown's UI)
Email ID:     ${email_id}
Subject:      ${subject}
Target URL:   ${target_url}

Review at:    https://buttondown.com/emails/${email_id}
Or drafts:    https://buttondown.com/emails

──────── body posted ────────

${body}

──────── end ────────

Operator notes:
- The draft is sitting in Buttondown's outbox. Open the review URL above
  (or Buttondown → Drafts) to edit the markdown / preview render / schedule.
- For monthly-digest cadence: hold drafts and send 1-3 together at the
  first of the month, or use Buttondown's 'schedule for' feature.
- Buttondown auto-appends the unsubscribe footer. Don't add your own.
EOF

    log_info "channel_buttondown: draft created (id=${email_id}); audit at $out_file"
    return 0
}
