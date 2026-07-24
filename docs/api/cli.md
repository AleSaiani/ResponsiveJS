# @responsivejs/cli — the `rjs` command line

The zero-setup surface of r$: point it at any URL and get the full oracle — constraints,
aesthetic score, a11y — as console output, JSON, or SARIF. Exit codes make it CI- and
agent-loop-ready: `0` pass, `1` violations, `2` usage/run error.

```
rjs analyze <url>              sweep + oracle (constraints + score + a11y)
rjs audit <url>                one-shot HTML report with screenshots
rjs verify <contract> <url>    execute a design contract against a live page
rjs record <contract> <url>    measure and pin baseline curves into the contract
rjs init <url>                 generate a contract from the page's r$ constructs
rjs doctor                     check drivers and environment readiness
```

## Options

| Option | Meaning | Default |
| --- | --- | --- |
| `-d, --driver` | `auto` \| `playwright` \| `agent-browser` | `auto` |
| `-w, --widths` | comma-separated widths (`320,768,1280`) | contract / built-in sweep |
| `-s, --selectors` | comma-separated selectors (analyze) | landmark set |
| `-f, --format` | `console` \| `json` \| `sarif` (contract SARIF carries each rule's authored intent) | `console` |
| `-o, --out` | write the report (or recorded contract) to a file | stdout |
| `--height` | viewport height | `900` |
| `--touch-min` | touch-target minimum px (analyze) | `24` (WCAG AA; platform is 44–48) |
| `--scroll` | scroll-sweep below-the-fold content | off |
| `--no-a11y` | skip axe (analyze) | axe runs when available |
| `--strict` | fail on warnings too (analyze) | errors only |
| `--headed` | show the browser window (playwright) | headless |
| `--vs <url>` | audit a second site side by side (audit) | — |
| `--crawl` | follow same-origin links (audit) | off |
| `--max-pages <n>` | crawl limit (audit) | `5` |
| `--screenshots <dir>` | also write the per-width PNGs to a directory (audit) | embedded only |

## Drivers

- **`playwright`** — chromium via the optional `playwright` / `@playwright/test` peer. The CI
  driver.
- **`agent-browser`** — [Vercel's agent-browser](https://github.com/vercel-labs/agent-browser)
  CLI, found on `PATH` (or via `AGENT_BROWSER_BIN`). Zero npm install in the target project:
  the oracle runs through the CLI's `eval`, with oversized injections (axe) chunked
  automatically. The driver uses an isolated `--session`.
- **`auto`** — playwright if installed, else agent-browser, else a clear install hint.

`rjs doctor` probes all of the above — node version, playwright + chromium, agent-browser —
one line per check with the exact install command for anything missing, and tells you which
driver `auto` will pick. Exit `0` = at least one driver usable, `1` = none.

## `audit` — the report you hand to someone

`rjs audit <url>` is analyze packaged as a deliverable: full oracle + per-width screenshots,
rendered into one **self-contained HTML file** (`rjs-audit.html` by default) — images
embedded, violation rectangles drawn as overlays from the *measured* rects, apply-verbatim
fixes tabled, provenance owners named. Nothing to install for the reader.

- `--crawl` walks same-origin links breadth-first up to `--max-pages` (default 5); pages
  discovered but not audited are reported, never silently dropped.
- `--vs <url>` audits a competitor too — the report leads with a side-by-side table
  (errors, warnings, checks, aesthetic score).
- `--screenshots <dir>` additionally saves the raw PNGs (`<host-path>-<width>.png`).
- Screenshots need a driver with the screenshot seam (playwright and agent-browser both
  have it). Without one the report says so and ships without images; passing
  `--screenshots` explicitly in that case is an error.
- Exit codes as analyze: `0` all pages pass, `1` violations, `--strict` gates on `clean`.

## `init` — the free regression net

On a page that runs `@responsivejs/runtime`, the constructs *declare* their behavior in the
provenance manifest. `rjs init <url> -o app.contract.json` turns those declarations into
rules the oracle verifies: numeric `fluid` on a measurable prop → `monotonic` + `continuous`
+ a baseline; `ratio` bounds → `proportion`; the page's `r$.breakpoints` → the viewport
widths — plus the `noOverflow` default. What can't be expressed yet (geometry, sync, tokens,
element-driven fluids) is listed on stderr, never dropped silently. Then `rjs record` pins
today's curves and `rjs verify` in CI holds the page to its own declarations. Exits 2 when
the page has no manifest.

## `verify` and `record`

The sweep is derived **from the contract itself**: selectors from rule args, widths from
`viewport` (plus `bp±1` for `breakpointSafe`). `record` fills `baselines[].curve` from
measurements and writes the contract back (`--out` to write elsewhere) — the
record-then-assert flow:

```bash
rjs record home.contract.json https://staging.example.com   # pin today's geometry
rjs verify home.contract.json https://pr-42.example.com     # regressions fail with exit 1
```

## Programmatic use

Everything the binary does is exported: `main(argv, io?)` (inject `CliIo` for testing),
`resolveDriver`, `DEFAULT_SELECTORS`.
