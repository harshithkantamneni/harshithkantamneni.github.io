"""Numeric verification for the factcheck judge.

The factcheck judge's job is to catch number *hallucination* (a value the
drafter invented that has no basis in the source). Its earlier implementation
did this with exact token-set membership: every numeric token in the draft
prose had to appear verbatim in the source. That over-flags the faithful
numeric transformations an LLM makes when writing prose from data, so legit
pieces got held on correct numbers.

Confirmed failure: the AGI "below-the-measurement-floor" report was held on a
single token — draft "6.01%" against source "0.0601" (conditional R²). They are
the same value (0.0601 x 100 = 6.01); a faithful percent conversion was scored
as a hallucination.

A draft number is verified here if the source contains the same value OR a
faithful representation of it:
  - exact match
  - percent <-> proportion (x100 / /100), e.g. draft 6.01% <- source 0.0601
  - rounding to the draft's stated decimal precision, e.g. draft 0.63 <- 0.6314

This is permissive about *representation* while still catching a value with no
exact / scaled / rounded twin in the source. The curator dashboard review is
the human gate before anything publishes.
"""
from __future__ import annotations


def _to_float(tok):
    try:
        return float(str(tok).replace(",", "").strip())
    except (ValueError, AttributeError):
        return None


def _decimals(tok) -> int:
    tok = str(tok).strip()
    return len(tok.split(".")[1]) if "." in tok else 0


def is_verified(draft_tok, source_floats) -> bool:
    """True if draft_tok is supported by some value in source_floats."""
    d = _to_float(draft_tok)
    if d is None:
        return True  # non-numeric token; nothing to verify
    dec = _decimals(draft_tok)
    for s in source_floats:
        if s is None:
            continue
        if abs(d - s) < 1e-9:
            return True  # exact
        # rounding tolerance, decimals only (integers must match exactly or
        # via an explicit scale, so an unrelated 4.7 can't "verify" a bare 5).
        if dec >= 1 and round(s, dec) == round(d, dec):
            return True
        # percent <-> proportion, compared at the draft's precision.
        if round(s * 100.0, dec) == round(d, dec):
            return True
        if round(s / 100.0, dec) == round(d, dec):
            return True
    return False


def compute_unverified(draft_tokens, source_tokens):
    """Return the sorted list of draft number-strings unsupported by source."""
    source_floats = [f for f in (_to_float(t) for t in source_tokens) if f is not None]
    out = {t for t in draft_tokens if not is_verified(t, source_floats)}
    return sorted(out, key=lambda x: (len(x), x))
