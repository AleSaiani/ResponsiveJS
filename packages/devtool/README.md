# @responsivejs/devtool

> The r$ oracle in your DevTools — the closed loop, visualized. Private package (an
> extension is shipped as a build artifact, not an npm module).

## What the panel does

- **Quick check** — measures the live viewport through the in-page collector
  (`inspectedWindow.eval`) and judges it: score HUD + grouped findings, provenance owners
  included. Click a finding to `inspect()` the element in the Elements panel.
- **Sweep** — attaches `chrome.debugger` (via the background proxy) and runs the REAL
  multi-width oracle: CDP viewport emulation + the same `sweepSource`/`analyzeStore` the CLI
  uses. Identical measurements, identical verdicts.
- **Curves** — pick element × property and see the *measured* `f(width)` plotted. This is
  the parametric plane made visible.
- **Contract recorder** — pin curves as baselines, toggle rules, and export a
  loader-valid contract JSON: wire it to `rjs verify` in CI and the page can never silently
  regress from what you inspected.
- **Mount overlay** — injects the M4 `browser-global` bundle and mounts `<rjs-overlay>` on
  the page.

## Develop / install

```bash
pnpm -F @responsivejs/devtool build   # → dist/
# chrome://extensions → Developer mode → Load unpacked → packages/devtool/dist
```

Open DevTools on any page → the **r$** panel.

## Testing

The chrome-free modules (`engine`, `curve-svg`, `recorder`) are unit-tested; the engine is
e2e-tested against real chromium with a Playwright `CDPSession` standing in for the
`chrome.debugger` hop (same `Messenger` seam the panel uses). The extension shell
(manifest/panel wiring) is thin by design — verify it manually with Load unpacked.

License: MPL-2.0
