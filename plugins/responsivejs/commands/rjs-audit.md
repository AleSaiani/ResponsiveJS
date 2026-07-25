---
description: Sweep a URL at many widths and report what actually renders — overflow, touch targets, contrast, curve continuity.
argument-hint: <url> [widths]
allowed-tools: Bash(npx @responsivejs/cli:*), Bash(rjs:*), Read
---

Measure `$1` with the r$ oracle and report the result.

1. Check the environment first: `npx @responsivejs/cli doctor`. If no driver is usable, stop and
   print the exact install command it suggests — do not fall back to guessing from the source.
2. Run `npx @responsivejs/cli analyze $1 -w ${2:-320,375,768,1024,1280,1920} -f json`.
3. Report, in this order: the pass/fail verdict with the counts, then each **error** grouped by
   rule with its selector, the widths it failed at, and the measured numbers. Warnings go in a
   short list after the errors — they do not fail the gate.
4. For every fix the report offers, respect its `kind`: apply `exact` verbatim, treat
   `heuristic` as a direction to verify, and for `runtime-patch` edit the r$ declaration named
   in the provenance (`owner`), not the CSS.
5. Do not fix anything unless asked. The deliverable is the measurement.
