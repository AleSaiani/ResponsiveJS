---
'@responsivejs/core': minor
'@responsivejs/runtime': minor
'@responsivejs/contract': minor
'@responsivejs/design': minor
'@responsivejs/cli': minor
'@responsivejs/react': minor
'@responsivejs/vue': minor
'@responsivejs/angular': minor
---

First public alpha of ResponsiveJS (`r$`).

One model — **`value = f(width)`**, viewport *and* container — with two halves that close a
loop: **author** responsive behavior CSS cannot express, then **verify** the rendered result
by measurement.

**Authoring (`runtime`)** — `r$` is one callable namespace. Fluid values compile to static
`clamp()`/`@media` wherever CSS suffices (the CSS-first contract) and fall back to a single
shared reactive graph only for what CSS cannot express: non-linear curves, colors,
**geometry state** (`whenWraps`, `whenStuck`, `whenTruncated`, `whenOverflows`, `linesOf`,
`whenCollides` → data-attributes your stylesheet reacts to), and **cross-element relations**
(`fromElement`, `sync`, `ratio`). Typed breakpoints turn a typo into a compile error; the
token bridge exports the scale as `clamp()` on `:root` and as DTCG JSON. Every construct
returns a handle that restores exactly what it changed — including inline values that
pre-existed it. `observe()` keeps a selector bound in SPAs, `scope()` disposes a component's
constructs together, `renderStatic()` gives a server the whole stylesheet, and
`@responsivejs/runtime/global` is the same API as a plain `<script>` (~15.5 kB gzip).

**Verification (`design` + `contract` + `cli`)** — measure a page (or a **component**, by
resizing its harness) across widths, then judge it: 27 constraints, WCAG contrast against
*effective* backgrounds, touch targets with DOM semantics, continuity checks on the measured
curve, an experimental aesthetic score. Reports are machine-readable and exit-code gated;
fixes declare whether they are `exact` (apply verbatim), `heuristic` (a direction), or a
`runtime-patch` (edit the construct, not the CSS). Contracts make the intent executable and
travel with the repo. `rjs` runs all of it on any URL — Playwright or agent-browser, zero
setup — plus `audit` (self-contained HTML report with screenshots), `init` (a contract
generated from your constructs) and `doctor`.

**The loop** — constructs publish a provenance manifest, so a violation names the construct
that owns the element and where it was declared. The agent patches the cause, not the symptom.

**Adapters** — `@responsivejs/react`, `@responsivejs/vue` and `@responsivejs/angular` own the
lifecycle: apply on mount, update in place, dispose on unmount. The Angular package is
decorator-free on purpose, so it needs no Angular compilation step.

Alpha: the API may still move. Everything documented is measured, and every example in the
docs is verified against the built code.
