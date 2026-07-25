# ResponsiveJS plugin for Claude Code

Two skills and one command, so an agent working in your repo writes responsive behavior the way
r$ intends — and verifies it instead of asserting it.

```
/plugin marketplace add AleSaiani/ResponsiveJS
/plugin install responsivejs@responsivejs
```

| Skill | Loads when |
| --- | --- |
| `responsive-authoring` | responsive CSS/JS is being written or refactored, or a breakpoint number is about to be chosen |
| `responsive-verification` | a UI change needs measuring, a contract needs writing, or CI needs a gate |

| Command | Does |
| --- | --- |
| `/rjs-audit <url> [widths]` | sweeps the URL and reports what actually renders, without fixing anything |

The command shells out to `@responsivejs/cli`, which needs a browser driver — `rjs doctor`
reports what is available and how to install what is not.

Docs: <https://responsivejs.com> · agent-readable index: <https://responsivejs.com/llms.txt>
