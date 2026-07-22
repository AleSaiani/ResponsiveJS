# Contributing to ResponsiveJS

Thanks for your interest! This document covers the practical side of contributing.

## Setup

Requirements: **Node ≥ 20.19** and **pnpm** (`corepack enable` gives you the pinned version).

```bash
git clone https://github.com/AleSaiani/ResponsiveJS.git
cd ResponsiveJS
pnpm install
```

## Everyday commands

| Command          | What it does                                              |
| ---------------- | --------------------------------------------------------- |
| `pnpm test`      | Run the unit suite (vitest, plain Node — no browsers).    |
| `pnpm typecheck` | Typecheck the whole workspace without building.           |
| `pnpm lint`      | ESLint over sources and tests.                            |
| `pnpm build`     | Build all packages (`tsc`, topological order).            |
| `pnpm format`    | Prettier over sources, tests and docs.                    |

Tests and typecheck resolve `@responsivejs/core` straight from source — no build needed during
development.

## Making a change

1. Fork and branch from `master`.
2. Make your change; add or update tests. CI runs lint + typecheck + tests on Linux and Windows.
3. If the change affects published packages, add a changeset:

   ```bash
   pnpm changeset
   ```

   Pick the packages and semver bump; write a short, user-facing description. Docs/CI-only changes
   don't need one.

4. Open a pull request. Keep it focused — one concern per PR.

## Design constraints (non-negotiable)

- **Framework-agnostic**: never depend on a specific framework's reactivity or components.
- **`@responsivejs/core` stays pure**: zero dependencies, no DOM access, browser-safe math only.
- **The browser entry (`design/browser`) stays driver-free**: it must run injected in any page.
- **Machine-readable reports**: violations carry structured `fix` suggestions.

## Releases

Releases are automated with [changesets](https://github.com/changesets/changesets): merging the
"chore: version packages" PR on `master` publishes to npm with provenance.
