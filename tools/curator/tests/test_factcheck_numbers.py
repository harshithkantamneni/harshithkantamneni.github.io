#!/usr/bin/env python3
"""Tests for the factcheck numeric matcher (../lib/factcheck_numbers.py).

Regression target: the curator held the AGI "below-the-measurement-floor" piece
(voice 9/10, novelty 10/10) on a single number — draft "6.01%" vs source
"0.0601" (conditional R²). 0.0601 x 100 = 6.01; a faithful percent conversion
was flagged as a hallucination. These tests pin the percent<->proportion and
rounding tolerances and confirm true hallucinations are still caught.

Run: python3 tools/curator/tests/test_factcheck_numbers.py
"""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "lib"))
from factcheck_numbers import is_verified, compute_unverified


def _naive_unverified(draft_tokens, source_tokens):
    """The OLD exact-set-difference matcher, kept to document the bug."""
    return sorted(set(draft_tokens) - set(source_tokens), key=lambda x: (len(x), x))


CASES = []


def check(name, cond):
    CASES.append((name, bool(cond)))


# --- the confirmed regression -------------------------------------------------
check("OLD matcher reproduces the bug (flags 6.01 against 0.0601)",
      "6.01" in _naive_unverified({"6.01"}, {"0.0601"}))
check("percent<->proportion: 6.01 verifies against 0.0601",
      is_verified("6.01", [0.0601]))
check("NEW matcher does not flag 6.01",
      "6.01" not in compute_unverified({"6.01"}, {"0.0601"}))

# --- exact match (the neighbor that already passed) ---------------------------
check("exact: 0.88 verifies against [0.88, 0.0088]",
      is_verified("0.88", [0.88, 0.0088]))

# --- rounding to draft precision (decimals only) ------------------------------
check("rounding: 0.63 verifies against 0.6314", is_verified("0.63", [0.6314]))
check("exact: 0.6314 verifies against 0.6314", is_verified("0.6314", [0.6314]))

# --- true hallucinations are still caught -------------------------------------
check("hallucination: 42 not verified by unrelated sources",
      not is_verified("42", [0.0601, 0.6314, 0.88, 5000]))
check("hallucination: 9.99 not verified",
      not is_verified("9.99", [0.05, 7.2, 100.0]))
check("integer 5 not over-matched by 4.7 (no decimals → exact/scaled only)",
      not is_verified("5", [4.7]))

# --- end-to-end on the real failing pair: nothing unverified now --------------
check("end-to-end: real pair yields no unverified",
      compute_unverified({"6.01", "0.88"}, {"0.0601", "0.0088", "0.88"}) == [])

failed = [n for n, ok in CASES if not ok]
for n, ok in CASES:
    print(f"  [{'PASS' if ok else 'FAIL'}] {n}")
if failed:
    print(f"\n{len(failed)} of {len(CASES)} FAILED")
    sys.exit(1)
print(f"\nAll {len(CASES)} passed")
