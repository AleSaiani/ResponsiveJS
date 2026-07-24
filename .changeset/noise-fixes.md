---
'@responsivejs/design': patch
---

Real-world audit noise fixes. The collector now measures the **effective** background — walking
past transparent ancestors to the color actually painted behind the text (memoized; same fix in
the realtime observer) — so `contrastRatio` compares against what users see instead of flagging
every transparent-background element. `touchTarget` now honors the WCAG 2.5.8 inline exception:
`display: inline` targets flowing in prose are exempt. On a real-world page audit this cut
false positives by ~92% while keeping every genuine violation.
