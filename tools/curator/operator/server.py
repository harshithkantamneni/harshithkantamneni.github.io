#!/usr/bin/env python3
"""
Local operator dashboard for the curator pipeline.

Single-user, localhost-only. Reads manifests / channel drafts / logs and
exposes a few action endpoints (retry held, mark a channel draft pasted).
Browser UI at http://127.0.0.1:8088/.

Run:
    bash tools/curator/cli.sh ui            # spawns + opens browser
    python3 tools/curator/operator/server.py --port 8088 --no-browser

Read-only by design except for two safe mutations:
  - retry: flip a held candidate's curator_state back to 'pending'
  - mark-pasted: delete a channel-draft .txt file once the operator pasted it

For anything else (vetoes, editing voice anchors, running the pipeline),
use the terminal CLI. The dashboard is a glance + light-touch tool.
"""
import argparse
import datetime
import difflib
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import urllib.parse
import webbrowser
from pathlib import Path

OPERATOR_DIR = Path(__file__).resolve().parent
CURATOR_DIR = OPERATOR_DIR.parent
WEBSITE_ROOT = CURATOR_DIR.parent.parent

HIVE_DIR = Path.home() / "Desktop" / "Fun" / "lab" / "publish_candidates"
AGI_DIR = Path.home() / "Desktop" / "AGI" / "data" / "publish_candidates"
CHANNEL_DIR = CURATOR_DIR / "channel_drafts"
LOG_DIR = CURATOR_DIR / "log"
PENDING_DRAFTS_DIR = CURATOR_DIR / "pending_drafts"

HOST = "127.0.0.1"
DEFAULT_PORT = 8088


# ── Read helpers ──────────────────────────────────────────────────────────

def iter_candidates():
    for lab, dir_path in [("HIVE", HIVE_DIR), ("AGI", AGI_DIR)]:
        if not dir_path.is_dir():
            continue
        for f in sorted(dir_path.glob("*.json")):
            try:
                d = json.load(open(f))
            except Exception:
                continue
            d["_lab"] = lab
            d["_file"] = str(f)
            yield d


def get_status():
    candidates = list(iter_candidates())

    def summarize(c):
        return {
            "lab": c.get("_lab"),
            "id": c.get("id", ""),
            "type": c.get("type", ""),
            "tier": c.get("risk_tier"),
            "state": c.get("curator_state", "unknown"),
            "title": c.get("title", ""),
            "summary": c.get("summary", ""),
            "held_reason": c.get("held_reason", ""),
            "processing_started_at": c.get("processing_started_at", ""),
            "awaiting_review_at": c.get("awaiting_review_at", ""),
            "published_at": c.get("published_at", ""),
            "channels": c.get("channels", []),
            "scores": c.get("scores", {}),
            "operator_notes": c.get("operator_notes", ""),
        }

    queue = [summarize(c) for c in candidates
             if c.get("curator_state") not in ("published", "vetoed")]
    awaiting = [summarize(c) for c in candidates
                if c.get("curator_state") == "awaiting_review"]
    awaiting.sort(key=lambda x: x.get("awaiting_review_at") or "", reverse=True)
    published = [summarize(c) for c in candidates
                 if c.get("curator_state") == "published"]
    published.sort(key=lambda x: x.get("published_at") or "", reverse=True)

    drafts = {"hackernews": [], "linkedin": []}
    for ch in ("hackernews", "linkedin"):
        d = CHANNEL_DIR / ch
        if d.is_dir():
            for f in sorted(d.glob("*.txt")):
                drafts[ch].append({
                    "id": f.stem,
                    "bytes": f.stat().st_size,
                    "mtime": datetime.datetime.fromtimestamp(
                        f.stat().st_mtime, tz=datetime.timezone.utc,
                    ).isoformat(),
                })

    # launchd was retired 2026-05-13 (macOS TCC blocked Desktop reads from
    # launchd-spawned bash; manual trigger from terminal works fine).
    launchd = None

    today_log = LOG_DIR / f"{datetime.date.today().isoformat()}.log"
    log_excerpt = ""
    if today_log.exists():
        try:
            lines = today_log.read_text(errors="replace").splitlines()
            log_excerpt = "\n".join(lines[-40:])
        except Exception:
            log_excerpt = ""

    runs = recent_runs(limit=8)

    return {
        "today": datetime.date.today().isoformat(),
        "queue": queue,
        "awaiting_review": awaiting,
        "published_recent": published[:5],
        "channel_drafts": drafts,
        "launchd": launchd,
        "log_excerpt": log_excerpt,
        "runs": runs,
    }


# ── Review-specific helpers ──────────────────────────────────────────────

def find_candidate_by_id(target_id: str):
    """Return (manifest_dict, file_path) or (None, None)."""
    for c in iter_candidates():
        if c.get("id") == target_id:
            return c, Path(c["_file"])
    return None, None


def get_review(target_id: str):
    c, f = find_candidate_by_id(target_id)
    if not c:
        return {"ok": False, "error": "candidate not found"}
    draft_path = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    judges_path = PENDING_DRAFTS_DIR / f"{target_id}.judges.json"
    source = draft_path.read_text() if draft_path.is_file() else ""
    judges = {}
    if judges_path.is_file():
        try:
            judges = json.loads(judges_path.read_text())
        except Exception:
            judges = {}

    # Pre-generated channel drafts (from review staging)
    channel_drafts = {}
    for ch in ("hackernews", "linkedin", "buttondown"):
        p = PENDING_DRAFTS_DIR / f"{target_id}.{ch}.txt"
        if p.is_file():
            channel_drafts[ch] = p.read_text()

    prev_path = PENDING_DRAFTS_DIR / f"{target_id}.astro.prev"
    has_prev = prev_path.is_file()

    return {
        "ok": True,
        "id": target_id,
        "has_prev": has_prev,
        "lab": c.get("_lab"),
        "title": c.get("title", ""),
        "summary": c.get("summary", ""),
        "type": c.get("type", ""),
        "tier": c.get("risk_tier"),
        "state": c.get("curator_state"),
        "channels": c.get("channels", []),
        "source": source,
        "source_path": str(draft_path),
        "judges": judges,
        "channel_drafts": channel_drafts,
        "operator_notes": c.get("operator_notes", ""),
        "awaiting_review_at": c.get("awaiting_review_at", ""),
        "cost_seconds": c.get("cost_seconds"),
    }


def save_review_source(target_id: str, new_source: str) -> dict:
    c, f = find_candidate_by_id(target_id)
    if not c:
        return {"ok": False, "error": "candidate not found"}
    if c.get("curator_state") != "awaiting_review":
        return {"ok": False,
                "error": f"state is '{c.get('curator_state')}', not awaiting_review"}
    draft_path = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    if not draft_path.is_file():
        return {"ok": False, "error": "pending draft file missing"}
    draft_path.write_text(new_source)
    return {"ok": True, "bytes": len(new_source)}


def save_operator_notes(target_id: str, notes: str) -> dict:
    c, f = find_candidate_by_id(target_id)
    if not c:
        return {"ok": False, "error": "candidate not found"}
    d = json.loads(f.read_text())
    d["operator_notes"] = notes
    f.write_text(json.dumps(d, indent=2))
    return {"ok": True}


def run_shell(cmd: list, timeout: int = 300) -> dict:
    """Run a curator shell script and return its combined output."""
    try:
        r = subprocess.run(cmd, capture_output=True, text=True,
                          timeout=timeout, cwd=str(WEBSITE_ROOT))
        return {
            "ok": r.returncode == 0,
            "returncode": r.returncode,
            "stdout": r.stdout[-5000:],
            "stderr": r.stderr[-5000:],
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": f"timeout after {timeout}s"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def approve_candidate(target_id: str) -> dict:
    c, f = find_candidate_by_id(target_id)
    if not c:
        return {"ok": False, "error": "candidate not found"}
    if c.get("curator_state") != "awaiting_review":
        return {"ok": False,
                "error": f"state is '{c.get('curator_state')}', not awaiting_review"}
    result = run_shell(["bash", "tools/curator/approve.sh", target_id], timeout=300)
    return result


def reject_candidate(target_id: str, reason: str) -> dict:
    c, f = find_candidate_by_id(target_id)
    if not c:
        return {"ok": False, "error": "candidate not found"}
    if c.get("curator_state") != "awaiting_review":
        return {"ok": False,
                "error": f"state is '{c.get('curator_state')}', not awaiting_review"}
    result = run_shell(["bash", "tools/curator/reject.sh", target_id, reason], timeout=15)
    return result


def revise_candidate(target_id: str, notes: str) -> dict:
    """Treat operator notes as a revision prompt; run claude --print to
    regenerate the pending draft. Persist notes to manifest too."""
    c, f = find_candidate_by_id(target_id)
    if not c:
        return {"ok": False, "error": "candidate not found"}
    if c.get("curator_state") != "awaiting_review":
        return {"ok": False,
                "error": f"state is '{c.get('curator_state')}', not awaiting_review"}
    if not notes.strip():
        return {"ok": False, "error": "notes are empty — nothing to revise on"}

    save_operator_notes(target_id, notes)

    fd, tmp_path = tempfile.mkstemp(suffix=".txt", text=True)
    try:
        with os.fdopen(fd, "w") as t:
            t.write(notes)
        result = run_shell(
            ["bash", "tools/curator/revise.sh", target_id, tmp_path],
            timeout=240,
        )
    finally:
        try: os.unlink(tmp_path)
        except FileNotFoundError: pass
    return result


# ── Undo + diff ───────────────────────────────────────────────────────────

def undo_revise(target_id: str) -> dict:
    """Restore <id>.astro from <id>.astro.prev (one-level undo of last revise)."""
    draft = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    prev = PENDING_DRAFTS_DIR / f"{target_id}.astro.prev"
    if not prev.is_file():
        return {"ok": False, "error": "no .prev snapshot available; nothing to undo"}
    if not draft.is_file():
        return {"ok": False, "error": "current draft missing"}
    # Swap so a subsequent undo redoes (poor-man's redo via repeat-undo).
    swap = PENDING_DRAFTS_DIR / f".{target_id}.swap"
    shutil.copyfile(draft, swap)
    shutil.copyfile(prev, draft)
    shutil.move(str(swap), str(prev))
    return {"ok": True, "message": f"{target_id} reverted to .prev"}


def get_diff(target_id: str) -> dict:
    """Return a unified diff between <id>.astro.prev and <id>.astro."""
    draft = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    prev = PENDING_DRAFTS_DIR / f"{target_id}.astro.prev"
    if not prev.is_file():
        return {"ok": True, "has_prev": False, "diff": ""}
    if not draft.is_file():
        return {"ok": False, "error": "current draft missing"}
    a = prev.read_text().splitlines(keepends=False)
    b = draft.read_text().splitlines(keepends=False)
    diff_lines = list(difflib.unified_diff(
        a, b, fromfile="previous", tofile="current", lineterm="",
    ))
    return {"ok": True, "has_prev": True, "diff": "\n".join(diff_lines)}


# ── Channel-draft editing ─────────────────────────────────────────────────

def save_channel_draft(target_id: str, channel: str, content: str) -> dict:
    if channel not in ("hackernews", "linkedin", "buttondown"):
        return {"ok": False, "error": f"unknown channel: {channel}"}
    p = PENDING_DRAFTS_DIR / f"{target_id}.{channel}.txt"
    if not p.is_file():
        return {"ok": False, "error": "pending channel draft missing"}
    p.write_text(content)
    return {"ok": True, "bytes": len(content)}


# ── Revision history ──────────────────────────────────────────────────────

def get_history(target_id: str) -> dict:
    log = PENDING_DRAFTS_DIR / f"{target_id}.history.jsonl"
    if not log.is_file():
        return {"ok": True, "entries": []}
    entries = []
    for line in log.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except Exception:
            continue
    entries.reverse()  # newest first
    return {"ok": True, "entries": entries}


def restore_history(target_id: str, snapshot: str) -> dict:
    history_dir = PENDING_DRAFTS_DIR / f"{target_id}.history"
    src = history_dir / snapshot
    # Defensive — keep the path inside the history dir
    try:
        src.resolve().relative_to(history_dir.resolve())
    except ValueError:
        return {"ok": False, "error": "invalid snapshot path"}
    if not src.is_file():
        return {"ok": False, "error": "snapshot not found"}
    draft = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    if not draft.is_file():
        return {"ok": False, "error": "current draft missing"}
    # Snapshot current to .prev before swapping, so undo still works.
    shutil.copyfile(draft, draft.with_suffix(".astro.prev"))
    shutil.copyfile(src, draft)
    return {"ok": True, "restored": snapshot}


# ── Real-preview helpers ──────────────────────────────────────────────────

PREVIEW_LIVE_DIR = WEBSITE_ROOT / "src" / "pages" / "preview"


def realpreview_setup(target_id: str) -> dict:
    """Copy the pending draft to src/pages/preview/<id>.astro so that an
    operator-running `npm run dev` server can render it at
    http://localhost:4321/preview/<id>. Returns the URL the dashboard
    iframe should load.

    Note: src/pages/preview/ is gitignored — files placed here never
    deploy to production.
    """
    draft = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    if not draft.is_file():
        return {"ok": False, "error": "pending draft missing"}
    PREVIEW_LIVE_DIR.mkdir(parents=True, exist_ok=True)
    dest = PREVIEW_LIVE_DIR / f"{target_id}.astro"
    shutil.copyfile(draft, dest)
    # Probe dev server (timeout 1s)
    dev_up = False
    try:
        import urllib.request
        urllib.request.urlopen("http://localhost:4321/", timeout=1)
        dev_up = True
    except Exception:
        dev_up = False
    return {
        "ok": True,
        "url": f"http://localhost:4321/preview/{target_id}",
        "dev_up": dev_up,
    }


def realpreview_teardown(target_id: str) -> dict:
    dest = PREVIEW_LIVE_DIR / f"{target_id}.astro"
    if dest.is_file():
        dest.unlink()
    return {"ok": True}


# ── Preview rendering ─────────────────────────────────────────────────────

_ASTRO_TAG_RE = re.compile(r"<([A-Z][A-Za-z0-9]*)\b([^>]*)/?>", re.DOTALL)


def _strip_astro_attrs(s: str) -> str:
    """Strip Astro-component-specific attributes from an HTML-ish string."""
    s = re.sub(r"\s+data-astro-cid-[a-z0-9-]+", "", s)
    s = re.sub(r"\s+set:html=\"[^\"]*\"", "", s)
    return s


def render_preview(astro_source: str) -> str:
    """Cheap, approximate render of Astro source for visual preview.

    Not a real Astro build — strips frontmatter + JSX expressions +
    Astro-specific tags, then wraps in basic styled HTML. Operator sees
    structure + prose; final production styling applies on publish.
    """
    text = astro_source

    text = re.sub(r"^---\n[\s\S]*?\n---\n?", "", text, count=1)

    # MetaStrip: <MetaStrip items={['REPORT', 'May 12, 2026']} />
    def _metastrip(m):
        inner = m.group(1)
        items = [
            x.strip().strip("'\"").strip()
            for x in re.split(r",", inner) if x.strip()
        ]
        return '<div class="meta">' + " · ".join(items) + "</div>"
    text = re.sub(r"<MetaStrip[^/>]*items=\{\[([^\]]*)\]\}[^/>]*/?>",
                  _metastrip, text)

    # SectionHead with title
    text = re.sub(
        r"<SectionHead[^>]*title=\"([^\"]+)\"[^>]*/?>",
        r'<h2 class="section-head">\1</h2>',
        text,
    )

    # PullQuote → blockquote
    text = re.sub(r"<PullQuote[^>]*>", "<blockquote>", text)
    text = re.sub(r"</PullQuote>", "</blockquote>", text)

    # Default wrapper → strip outer tags (keep contents)
    text = re.sub(r"<Default\b[^>]*>", "", text)
    text = re.sub(r"</Default>", "", text)

    # ProvenanceFooter and other capitalised components → strip outer, keep body
    text = re.sub(r"<([A-Z][A-Za-z0-9]*)\b[^>]*/>", "", text)
    text = re.sub(r"<([A-Z][A-Za-z0-9]*)\b[^>]*>", "", text)
    text = re.sub(r"</[A-Z][A-Za-z0-9]*>", "", text)

    # Strip JSX expressions: `{...}`. Handle nested template strings naively.
    text = re.sub(r"\{`[^`]*`\}", "", text)
    text = re.sub(r"\{[^{}\n]*?\}", "", text)

    # Strip Astro import statements that may have leaked.
    text = re.sub(r"^import\s+.+$", "", text, flags=re.MULTILINE)

    # Strip leftover ${...} interpolations inside attribute strings.
    text = re.sub(r"\$\{[^}]*\}", "", text)

    text = _strip_astro_attrs(text)

    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


PREVIEW_CSS = """
  body { font-family: Georgia, 'Iowan Old Style', 'Times New Roman', serif;
         max-width: 720px; margin: 32px auto 80px; padding: 0 24px;
         color: #1a1a1a; background: #fafafa; line-height: 1.7; font-size: 18px; }
  h1 { font-size: 2.2em; font-weight: 700; line-height: 1.1; margin: 1.2em 0 0.3em; letter-spacing: -0.02em; }
  h2 { font-size: 1.3em; font-weight: 600; color: #444; margin: 2em 0 0.6em; text-transform: uppercase; letter-spacing: 0.05em; }
  h2.section-head { border-top: 1px solid #d0d0d0; padding-top: 1em; font-size: 0.85em; color: #666; }
  h3 { font-size: 1.1em; font-weight: 600; margin: 1.5em 0 0.4em; }
  p { margin: 1em 0; }
  .meta { font-family: ui-monospace, "SF Mono", Menlo, monospace;
          font-size: 0.78em; color: #888; margin: 0.5em 0 1.5em;
          text-transform: uppercase; letter-spacing: 0.08em; }
  blockquote { border-left: 3px solid #888; padding: 0.3em 1em;
               color: #333; font-style: italic; margin: 1.4em 0;
               background: #f3f3f3; }
  code { background: #ececec; padding: 0.1em 0.35em; border-radius: 3px;
         font-family: ui-monospace, Menlo, monospace; font-size: 0.85em; }
  pre { background: #f0f0f0; padding: 1em; overflow-x: auto;
        border-radius: 4px; font-size: 0.85em; }
  pre code { background: none; padding: 0; }
  a { color: #2c5fa8; text-decoration: underline; }
  ul, ol { padding-left: 1.4em; }
  li { margin: 0.4em 0; }
  hr { border: none; border-top: 1px solid #ddd; margin: 2.5em 0; }
  .preview-banner { background: #fffbe6; border: 1px solid #ffd166;
                    padding: 8px 14px; font-family: ui-monospace, Menlo, monospace;
                    font-size: 12px; margin-bottom: 28px; border-radius: 3px;
                    color: #8a6d00; }
"""


def preview_html(target_id: str) -> str:
    draft_path = PENDING_DRAFTS_DIR / f"{target_id}.astro"
    if not draft_path.is_file():
        return ("<html><body style='font-family:sans-serif;padding:40px;color:#900'>"
                "<h2>No pending draft found</h2></body></html>")
    source = draft_path.read_text()
    body = render_preview(source)
    return (
        "<!doctype html><html><head><meta charset='utf-8'>"
        f"<title>Preview: {target_id}</title>"
        f"<style>{PREVIEW_CSS}</style></head><body>"
        "<div class='preview-banner'>PREVIEW MODE — Astro components stripped; "
        "real styling applies on publish. Edit source via 'source' tab.</div>"
        f"{body}"
        "</body></html>"
    )


def recent_runs(limit=10):
    if not LOG_DIR.is_dir():
        return []
    log_files = sorted(LOG_DIR.glob("2*.log"), reverse=True)[:7]
    out = []
    for f in log_files:
        try:
            text = f.read_text(errors="replace")
        except Exception:
            continue
        run_ids = sorted(set(re.findall(r"\[(\d{8}-\d{6}-\d+)\]", text)),
                         reverse=True)
        for run_id in run_ids:
            run_lines = [ln for ln in text.splitlines() if f"[{run_id}]" in ln]
            blob = "\n".join(run_lines)
            if "FAILED" in blob:
                outcome = "fail"
            elif "curator run end (exit 0)" in blob:
                outcome = "ok"
            else:
                outcome = "partial"
            candidates = sum(1 for ln in run_lines if "── candidate:" in ln)
            out.append({
                "run_id": run_id,
                "outcome": outcome,
                "candidates": candidates,
                "source": f.name,
            })
            if len(out) >= limit:
                return out
    return out


# ── Mutation helpers ──────────────────────────────────────────────────────

def retry_candidate(target_id: str):
    for c in iter_candidates():
        if c.get("id") == target_id:
            f = Path(c["_file"])
            d = json.load(open(f))
            if d.get("curator_state") != "held":
                return {"ok": False,
                        "error": f"state is '{d.get('curator_state')}', not held"}
            d["curator_state"] = "pending"
            d.pop("held_reason", None)
            f.write_text(json.dumps(d, indent=2))
            return {"ok": True, "message": f"{target_id} → pending"}
    return {"ok": False, "error": "candidate not found"}


def get_channel_draft(channel: str, draft_id: str):
    if channel not in ("hackernews", "linkedin"):
        return None
    f = CHANNEL_DIR / channel / f"{draft_id}.txt"
    if not f.is_file():
        return None
    return f.read_text()


def parse_hn_draft(text: str) -> dict:
    """Pull the suggested title and target URL out of an HN paste-ready file.

    File format (deterministic — produced by channel_hackernews.sh):
        HACKER NEWS SUBMISSION
        ======================

        Submit at: https://news.ycombinator.com/submit
        Account:   harshithkantamneni

        Suggested title (38 chars):
        Twelve cycles of byte-identical builds

        URL:
        https://harshithkantamneni.github.io/...
    """
    out = {"title": "", "url": ""}
    lines = text.splitlines()
    for i, line in enumerate(lines):
        if line.startswith("Suggested title"):
            if i + 1 < len(lines):
                out["title"] = lines[i + 1].strip()
        elif line.strip() == "URL:":
            if i + 1 < len(lines):
                out["url"] = lines[i + 1].strip()
    return out


def delete_channel_draft(channel: str, draft_id: str) -> bool:
    if channel not in ("hackernews", "linkedin"):
        return False
    f = CHANNEL_DIR / channel / f"{draft_id}.txt"
    if not f.is_file():
        return False
    f.unlink()
    return True


# ── HTTP handler ──────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):  # quieter logs
        pass

    def _send_json(self, payload, status: int = 200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def _send_file(self, p: Path, content_type: str):
        if not p.is_file():
            self.send_response(404); self.end_headers(); return
        data = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path
        qs = urllib.parse.parse_qs(url.query)

        if path in ("/", "/index.html"):
            self._send_file(OPERATOR_DIR / "dashboard.html",
                            "text/html; charset=utf-8")
        elif path == "/api/status":
            self._send_json(get_status())
        elif path == "/api/channel-draft":
            channel = qs.get("channel", [""])[0]
            cid = qs.get("id", [""])[0]
            text = get_channel_draft(channel, cid)
            if text is None:
                self._send_json({"ok": False, "error": "not found"}, 404)
            else:
                payload = {"ok": True, "content": text}
                if channel == "hackernews":
                    payload["meta"] = parse_hn_draft(text)
                self._send_json(payload)
        elif path == "/api/review":
            cid = qs.get("id", [""])[0]
            if not cid:
                self._send_json({"ok": False, "error": "id required"}, 400)
            else:
                self._send_json(get_review(cid))
        elif path == "/api/preview":
            cid = qs.get("id", [""])[0]
            if not cid:
                self.send_response(400); self.end_headers(); return
            html = preview_html(cid).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(html)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(html)
        elif path == "/api/review/diff":
            cid = qs.get("id", [""])[0]
            if not cid:
                self._send_json({"ok": False, "error": "id required"}, 400)
            else:
                self._send_json(get_diff(cid))
        elif path == "/api/review/history":
            cid = qs.get("id", [""])[0]
            if not cid:
                self._send_json({"ok": False, "error": "id required"}, 400)
            else:
                self._send_json(get_history(cid))
        elif path == "/api/review/stream":
            self._stream_action(qs)
        elif path == "/api/run/stream":
            self._stream_pipeline(qs)
        else:
            self.send_response(404); self.end_headers()

    def _stream_action(self, qs):
        """Server-Sent Events stream of a long-running curator action.

        action=approve|revise; id=<candidate id>.
        For revise: reads operator_notes from the manifest (must be set
        via /api/review/notes beforehand).
        """
        action = qs.get("action", [""])[0]
        target_id = qs.get("id", [""])[0]
        if action not in ("approve", "revise") or not target_id:
            self.send_response(400); self.end_headers(); return

        c, mfile = find_candidate_by_id(target_id)
        if not c or c.get("curator_state") != "awaiting_review":
            self.send_response(409); self.end_headers(); return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        def emit(event: str, payload: str) -> bool:
            try:
                msg = f"event: {event}\ndata: {json.dumps({'line': payload})}\n\n"
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
                return True
            except (BrokenPipeError, ConnectionResetError):
                return False

        notes_tmp = None
        if action == "approve":
            cmd = ["bash", "tools/curator/approve.sh", target_id]
        else:
            notes = c.get("operator_notes", "") or ""
            if not notes.strip():
                emit("error", "operator_notes empty; save a comment first")
                emit("done", "")
                return
            fd, notes_tmp = tempfile.mkstemp(suffix=".txt", text=True)
            with os.fdopen(fd, "w") as t:
                t.write(notes)
            cmd = ["bash", "tools/curator/revise.sh", target_id, notes_tmp]

        try:
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                bufsize=1, text=True, cwd=str(WEBSITE_ROOT),
            )
            for line in iter(proc.stdout.readline, ""):
                line = line.rstrip("\n")
                if not emit("log", line):
                    proc.terminate()
                    break
            proc.wait(timeout=300)
            rc = proc.returncode
            try:
                msg = f"event: done\ndata: {json.dumps({'rc': rc})}\n\n"
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
        except Exception as e:
            emit("error", str(e))
        finally:
            if notes_tmp:
                try: os.unlink(notes_tmp)
                except FileNotFoundError: pass

    def _stream_pipeline(self, qs):
        """Run `bash tools/curator/run.sh` and stream stdout/stderr via SSE.

        Query params:
          dry_run=1   set DRY_RUN=1 in the subprocess environment
          skip_ram=1  pass --skip-ram-check on the command line
          debug=1    set CURATOR_DEBUG=1
        """
        dry_run  = qs.get("dry_run",  ["0"])[0] == "1"
        skip_ram = qs.get("skip_ram", ["0"])[0] == "1"
        debug    = qs.get("debug",    ["0"])[0] == "1"

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Accel-Buffering", "no")
        self.end_headers()

        def emit(event: str, payload: str) -> bool:
            try:
                msg = f"event: {event}\ndata: {json.dumps({'line': payload})}\n\n"
                self.wfile.write(msg.encode("utf-8"))
                self.wfile.flush()
                return True
            except (BrokenPipeError, ConnectionResetError):
                return False

        cmd = ["bash", "tools/curator/run.sh"]
        if skip_ram:
            cmd.append("--skip-ram-check")
        env = os.environ.copy()
        if dry_run:
            env["DRY_RUN"] = "1"
        if debug:
            env["CURATOR_DEBUG"] = "1"

        flag_summary = []
        if dry_run:  flag_summary.append("DRY_RUN=1")
        if skip_ram: flag_summary.append("--skip-ram-check")
        if debug:    flag_summary.append("CURATOR_DEBUG=1")
        emit("log", f"▸ launching: bash tools/curator/run.sh "
                    f"{' '.join(flag_summary) if flag_summary else '(no flags)'}")

        try:
            proc = subprocess.Popen(
                cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                bufsize=1, text=True, cwd=str(WEBSITE_ROOT), env=env,
            )
            for line in iter(proc.stdout.readline, ""):
                line = line.rstrip("\n")
                if not emit("log", line):
                    proc.terminate()
                    break
            proc.wait(timeout=1800)  # 30 min ceiling; pipeline rarely exceeds 5
            rc = proc.returncode
            try:
                self.wfile.write(
                    f"event: done\ndata: {json.dumps({'rc': rc})}\n\n".encode()
                )
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                pass
        except Exception as e:
            emit("error", str(e))

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path
        length = int(self.headers.get("Content-Length", 0))
        try:
            data = json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except json.JSONDecodeError:
            data = {}

        if path == "/api/retry":
            target = (data.get("id") or "").strip()
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = retry_candidate(target)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/save":
            target = (data.get("id") or "").strip()
            source = data.get("source", "")
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = save_review_source(target, source)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/notes":
            target = (data.get("id") or "").strip()
            notes = data.get("notes", "")
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = save_operator_notes(target, notes)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/approve":
            target = (data.get("id") or "").strip()
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = approve_candidate(target)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/reject":
            target = (data.get("id") or "").strip()
            reason = (data.get("reason") or "operator rejected via dashboard").strip()
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = reject_candidate(target, reason)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/revise":
            target = (data.get("id") or "").strip()
            notes = data.get("notes") or ""
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = revise_candidate(target, notes)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/undo":
            target = (data.get("id") or "").strip()
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = undo_revise(target)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/channel/save":
            target = (data.get("id") or "").strip()
            channel = (data.get("channel") or "").strip()
            content = data.get("content") or ""
            if not target or not channel:
                self._send_json({"ok": False, "error": "id and channel required"}, 400)
                return
            result = save_channel_draft(target, channel, content)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/history/restore":
            target = (data.get("id") or "").strip()
            snapshot = (data.get("snapshot") or "").strip()
            if not target or not snapshot:
                self._send_json({"ok": False, "error": "id and snapshot required"}, 400)
                return
            result = restore_history(target, snapshot)
            self._send_json(result, 200 if result.get("ok") else 400)
        elif path == "/api/review/realpreview":
            target = (data.get("id") or "").strip()
            if not target:
                self._send_json({"ok": False, "error": "id required"}, 400)
                return
            result = realpreview_setup(target)
            self._send_json(result, 200 if result.get("ok") else 400)
        else:
            self.send_response(404); self.end_headers()

    def do_DELETE(self):
        url = urllib.parse.urlparse(self.path)
        path = url.path
        qs = urllib.parse.parse_qs(url.query)

        if path == "/api/channel-draft":
            channel = qs.get("channel", [""])[0]
            cid = qs.get("id", [""])[0]
            ok = delete_channel_draft(channel, cid)
            self._send_json({"ok": ok})
        elif path == "/api/review/realpreview":
            cid = qs.get("id", [""])[0]
            if not cid:
                self._send_json({"ok": False, "error": "id required"}, 400)
            else:
                self._send_json(realpreview_teardown(cid))
        else:
            self.send_response(404); self.end_headers()


# ── Main ──────────────────────────────────────────────────────────────────

def main():
    p = argparse.ArgumentParser(description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--port", type=int, default=DEFAULT_PORT)
    p.add_argument("--no-browser", action="store_true",
                   help="don't auto-open browser")
    args = p.parse_args()

    try:
        server = socketserver.ThreadingTCPServer((HOST, args.port), Handler)
    except OSError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print(f"  Port {args.port} may already be in use. Try --port 8089.",
              file=sys.stderr)
        sys.exit(1)

    server.daemon_threads = True
    url = f"http://{HOST}:{args.port}/"
    print(f"Operator dashboard at {url}")
    print(f"  (CTRL-C to stop)")

    if not args.no_browser:
        threading.Timer(0.5, lambda: webbrowser.open(url)).start()

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nshutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
