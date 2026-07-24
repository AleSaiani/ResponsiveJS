---
'@responsivejs/runtime': minor
---

`r$` is now the runtime's entry point: one callable namespace carrying the whole authoring
surface — `r$(target, map)` applies, `r$.fluid`, `r$.tokens`, `r$.geometry`, `r$.whenWraps`,
`r$.breakpoints`, `r$.sync`, `r$.fromElement`, … — so the editor's autocomplete is the API
browser. `responsive` remains as an alias of the same object, and every member keeps its named
export for tree-shaking-sensitive code.
