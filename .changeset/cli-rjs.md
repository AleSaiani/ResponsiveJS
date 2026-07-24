---
'@responsivejs/cli': minor
'@responsivejs/design': minor
---

New package `@responsivejs/cli` — the `rjs` command line: `analyze <url>` (full oracle:
constraints + aesthetic score + a11y), `verify <contract> <url>` and `record <contract> <url>`
(the record-then-assert baseline flow, sweep derived from the contract itself). Output as
branded console report, JSON, or SARIF; exit codes 0/1/2 for CI and agent loops. Drivers are
pluggable — Playwright (optional peer) or Vercel's agent-browser CLI (zero-setup audits of any
live URL) — with `--driver auto` resolution. In `@responsivejs/design`, `contractSweepPlan()`
exposes the contract-derived sweep (selectors, widths, height) for any MeasurementSource.
