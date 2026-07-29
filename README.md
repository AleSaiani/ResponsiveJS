# ResponsiveJS (`r$`)

[![CI](https://github.com/AleSaiani/ResponsiveJS/actions/workflows/ci.yml/badge.svg)](https://github.com/AleSaiani/ResponsiveJS/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@responsivejs/runtime?color=cb3837&label=npm)](https://www.npmjs.com/package/@responsivejs/runtime)
[![License: MPL-2.0](https://img.shields.io/badge/License-MPL--2.0-blue.svg)](LICENSE)

**Your layout is a function of width. Treat it like one — then measure whether the browser
agreed.**

Two halves of one model, `value = f(width)`: *author* the responsive behavior CSS cannot
express, and *verify* the rendered result at every width with an exit code your CI can fail on.

📖 **[responsivejs.com](https://responsivejs.com)** — docs, live demos and the API reference.
Everything is also in [`docs/`](docs/README.md), which is where the site reads it from.

> ### 🚧 Alpha — `1.0.0-alpha.0`
>
> The version number says where the API is heading; **alpha** says it has not met real users
> yet. The **verification half is the mature one** — it runs in this repository's own CI against
> [this site's contract](site/site.contract.json), 1500+ checks at 8 widths, every build. The
> **authoring surface may still move**: breaking changes go in the changelog with the reason,
> and there has already been one (a container-bound value must now declare its range).
>
> Note for semver: prereleases are excluded from `^1.0.0` ranges. `npm i` installs it because
> `latest` points here; a hand-written `^1.0.0` will not.

---

## 30 seconds, nothing installed

Point it at a site you already have. No import, no config, no decision:

```bash
npx @responsivejs/cli analyze https://your-site.com -w 320,375,768,1024,1280,1920
```

Real output, on a small page with three ordinary mistakes:

```
r$ ✗ fail — 13 errors, 0 warnings, 0 info (74 checks)

  noOverflow (3 across 1 element)
    document @320,375,768px — the page scrolls horizontally: content reaches 789px
    in a 320px viewport (+469px). Something wider than the viewport is not inside
    a scroll container.
  contrastRatio (4 across 1 element)
    p[1] @320,375,768,1280px — contrast=2.32:1 < 4.5:1 (AA)
  touchTarget (6 across 2 elements)
    a[href][0] @320,375,768px — 55x16px < 24x24px
    button[0] @320,375,768px — 72x16px < 24x24px

  fixes available: 2
```

Exit `0` pass, `1` violations. Every finding carries the element, the width, the measured
numbers and — where an honest one exists — a fix labelled `exact`, `heuristic` or
`runtime-patch`. `-f json` or `-f sarif` for machines.

Liked what it found? [Pin it as a contract](docs/adopting.md) and gate it in CI — still without
writing a line of r$.

## What it does that CSS cannot

**A breakpoint that cannot rot.** The number in `@media (max-width: 843px)` is a guess about
content: add a link, translate to German, change the font, and it is wrong. Measure instead:

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```
```css
.site-nav[data-wrapped]           { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .burger { display: block; }
```

**JS states the fact, CSS decides what it means.** Same shape for the things CSS has no selector
for: `whenTruncated` (text really got clipped), `whenStuck` (a sticky element is pinned right
now), `whenOverflows`, `whenCollides`, `linesOf`.

**A value that scales, compiled to CSS.** Linear fluid values ship as a static `clamp()` — zero
JavaScript at runtime — and the JS half runs only for what CSS can't do: curves, colour ramps in
OKLab, cross-element relations.

```typescript
r$('.card', { padding: r$.fluid(12, 36) });   // → clamp(12px, calc(…vw), 36px)
```

**A layout rule your CI can fail on.** What the page promises about itself, as reviewable JSON:

```bash
npx @responsivejs/cli init   https://your-site.com -o site.contract.json   # works on ANY page
npx @responsivejs/cli record site.contract.json https://your-site.com      # pin today's curves
npx @responsivejs/cli verify site.contract.json http://localhost:4173/     # the gate
```

## It found real bugs in the site you are reading about

This documentation site is built with r$ and verified by r$ in CI, against its own contract.
Doing that caught, in our own code: a semi-transparent code chip failing AA once composited
over what was actually painted behind it; a nav title measuring 17×64 against the WCAG 24px
floor; `grid-template-columns: 1fr` silently meaning `minmax(auto, 1fr)` and pushing a code
block past the viewport — twice, in two different components.

None of those are visible in a screenshot review. All of them are one exit code away.

## Packages

| Package | What it is |
| --- | --- |
| [`@responsivejs/cli`](packages/cli) | The `rjs` command: `analyze` · `audit` · `init` · `record` · `verify` · `doctor`. Start here. |
| [`@responsivejs/runtime`](packages/runtime) | Authoring: `value = f(width)`, viewport and container, CSS-first. ~15.5 kB gzip standalone. |
| [`@responsivejs/design`](packages/design) | The oracle: constraints, WCAG checks, provenance, reports with fixes. Driver-pluggable. |
| [`@responsivejs/contract`](packages/contract) | The contract DSL: declarative, serializable, JSON-Schema'd. |
| [`@responsivejs/core`](packages/core) | The shared math: geometry, curves, stats, colour, typography. Pure, zero-dep. |
| [`@responsivejs/react`](packages/react) · [`/vue`](packages/vue) · [`/angular`](packages/angular) | Lifecycle bindings. The declaration is identical in all three. |
| [`devtool`](packages/devtool) | Chrome extension: width sweep, per-property `f(width)` inspector, element picker, contract recorder. Loaded unpacked. |

ESM-only · zero runtime dependencies · Node ≥ 20.19 · Playwright and axe-core are optional peers
of `design`.

## Documentation

| | |
| --- | --- |
| [Getting started](docs/getting-started.md) | one command, nothing installed |
| [Adopting r$ in an existing site](docs/adopting.md) | measure → contract → CI gate → *then* constructs |
| [The tutorial](docs/tutorial.md) | the other direction: empty page → verified landing, ~30 min |
| [Why r$ (and when not to)](docs/why.md) | "I can write `clamp()` myself", Percy, axe, container queries |
| [Troubleshooting](docs/troubleshooting.md) | by symptom |
| [The pattern catalog](docs/guides/case-studies.md) | every construct on a real problem |
| [API reference](docs/README.md) | runtime · design · contract · cli · core · adapters |

## For AI agents

Reports are machine-readable by design: `{ violations, fixes, provenance }`, SARIF for
code-scanning, exit codes for loops. A violation on an element a construct owns names **which
construct and at which line** — so the fix goes to the declaration, not to the cascade.

The docs site publishes source markdown rather than HTML to scrape:
[`llms.txt`](https://responsivejs.com/llms.txt) as the index,
[`llms-full.txt`](https://responsivejs.com/llms-full.txt) for a single fetch, and a `.md` twin of
every page. In Claude Code, [`plugins/responsivejs`](plugins/responsivejs/README.md) adds two
skills and an `/rjs-audit` command:

```
/plugin marketplace add AleSaiani/ResponsiveJS
/plugin install responsivejs@responsivejs
```

## Roadmap

**Shipped**: the math (`core`), the authoring runtime with geometry predicates, fluid tokens,
container-aware values and typed breakpoints; the oracle with WCAG checks, provenance and
contracts; the `rjs` CLI; React / Vue / Angular bindings; the DevTools extension.

**Next**, in order:

- **The library talks while you code** — an oscillation detector for the measure-what-you-restyle
  trap, an in-page dev overlay, and `rjs dev` watching your dev server and printing only the
  delta since your last save.
- **It fixes instead of only reporting** — `rjs fix` for the `exact` fixes, with contrast solved
  mathematically rather than suggested.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Node ≥ 20.19 and pnpm. `pnpm test` runs 669 unit tests;
`pnpm test:e2e` runs 32 against real Chromium.

## License

[MPL-2.0](LICENSE). **Every file in this repository is subject to the Mozilla Public License,
v. 2.0** unless that file says otherwise — the notice lives here rather than at the top of each
file, which is the placement the license itself contemplates (Exhibit A). A copy ships inside
every published package.

What that means in practice: MPL is copyleft **per file**, not per project. You can use these
packages in a closed-source product with no obligation on your own code. If you modify a file
that came from here and distribute it, that file's source has to stay available under the same
license. Linking, importing and bundling are not modifications.
