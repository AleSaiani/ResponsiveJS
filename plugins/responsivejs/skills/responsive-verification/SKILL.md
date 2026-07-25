---
name: responsive-verification
description: Measure a rendered page at many widths and judge it — overflow, WCAG touch targets and contrast, curve continuity — with the rjs CLI, and pin the intent in a design contract for CI. Use when checking responsive work, reviewing a UI change, wiring a CI gate, or when asked whether a page "looks right" on mobile.
---

# Verifying with rjs

A screenshot reviewed by a human at one width is not evidence. `rjs` drives a real browser
across a width sweep, measures the rendered result, and exits non-zero when it disagrees with
what you declared.

## The three commands that matter

```bash
rjs analyze <url> -w 320,768,1280,1920      # the full oracle, ad hoc
rjs verify  <contract.json> <url>           # a contract you committed — the CI gate
rjs audit   <url> -o report.html            # a self-contained report for a human
```

Exit codes are the contract with your loop: `0` pass, `1` violations, `2` usage or run error.
Add `-f json` (or `-f sarif` for code-scanning) when you need to read the result rather than
show it. `rjs doctor` tells you which driver is available before you debug a phantom failure.

## Reading a violation

Every finding carries the rule, the **selector**, the **width it was measured at**, the actual
numbers, and a severity. `pass` means zero *errors* — warnings do not fail the gate, so
`✓ 794/799 checks (5 warnings — no errors)` is a pass, not five failures.

When a runtime construct owns the element, the finding also names it (`↳ style at
src/cards.ts:12`). **Fix the declaration it names, not the CSS downstream of it.**

Fixes are labelled by kind and must be treated differently:

- `exact` — apply verbatim; the number is computed from the measurement.
- `heuristic` — a direction, not an answer. Verify before applying.
- `runtime-patch` — the cause is an r$ declaration; edit that, not the stylesheet.

## Writing the contract

A contract is what the page *promises about itself*, in JSON, committed next to the code. Start
from the page rather than from a blank file:

```bash
rjs init <url> -o site.contract.json     # derives rules from the r$ constructs it finds
rjs record site.contract.json <url>      # pins baseline curves (re-run when a change is intended)
```

Useful assertions beyond the defaults: `noOverflow`, `touchTarget` (WCAG 2.5.8, 24px floor),
`contrastRatio` (composited against the background actually painted), `monotonic` and
`continuous` on a measured property, `visible`/`hidden` per width range.

A baseline that fails after an intentional design change is not a bug to silence: re-run
`rjs record` and commit the new curve, so the diff shows the intent.

## In CI

```yaml
- run: npx @responsivejs/cli verify site.contract.json http://localhost:4173/ -d playwright
```

Run it against the built site, not the dev server. Widths live in the contract, so the gate and
the local run measure the same thing.

## Honest limits

The oracle measures what is rendered: geometry, contrast, target size, continuity. It does not
know whether a design is *good*, and it cannot see anything behind an interaction it was not
told to perform. Report what it measured; do not upgrade a pass into an aesthetic verdict.

Full reference: https://responsivejs.com/llms.txt
