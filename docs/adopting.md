# Adopting r$ in a site you already have

The [tutorial](tutorial.md) builds a page from nothing. This is the other path: you have a
codebase, media queries you did not write, and no appetite for a rewrite. Nothing here asks you
to change a line of CSS until step 4 — and step 4 is optional.

Each step is useful on its own. Stop wherever the value stops.

## Step 1 — Measure what you have (about a minute, nothing installed)

```bash
npx @responsivejs/cli analyze https://your-site.com -w 320,375,768,1024,1280,1920
```

You get every width judged: what overflows, which targets are under the WCAG 24px floor, where
contrast fails against the background actually painted, and — if the page scrolls sideways at
any width — the document's own reach. Exit `0` pass, `1` violations.

If nothing is found, you have learned something real for the price of a minute. If plenty is
found, do not fix it yet: pin it first.

**No browser driver?** `npx @responsivejs/cli doctor` tells you what is available and the exact
install command for what is not.

## Step 2 — Pin today's reality as a contract

```bash
npx @responsivejs/cli init https://your-site.com -o site.contract.json
```

This works on a page that has never heard of r$: the rules that carry most of the value need
neither a construct nor a selector you have to invent. You get a JSON file with the page-wide
rules, plus baselines for the headings and body text it found. Read it — it is meant to be
reviewed, not trusted blindly. Delete rules you disagree with, tighten the ones you care about.

```bash
npx @responsivejs/cli record site.contract.json https://your-site.com   # pin today's curves
```

`record` measures the current type scale and writes it into the contract. From now on, a change
to those curves is a **diff in a reviewed file** rather than a surprise.

## Step 3 — Make it a gate

```yaml
- run: npx @responsivejs/cli verify site.contract.json http://localhost:4173/ -d playwright
```

Run it against the built site, not the dev server. Two rules for keeping the gate trusted:

- **Start from green.** If the audit found twenty violations, do not gate on all twenty on day
  one. Fix, or narrow the contract with `when: { min, max }` ranges, until it passes — a gate
  that is red on arrival gets ignored within a week.
- **Warnings are not failures.** Only errors fail. `✓ 794/799 checks (5 warnings — no errors)`
  is a pass, and the five are worth a look, not a build break.

At this point you have regression protection and have written no r$ code at all. For a lot of
teams this is the whole adoption.

## Step 4 — Replace the breakpoints that actually hurt

Now, and only now, is the runtime worth installing — and even then, one construct at a time.
Start with the breakpoints that keep rotting, not with the ones that work:

```bash
npm i @responsivejs/runtime
```

**The burger that is wrong in German.** A hand-picked `@media (max-width: 843px)` breaks when a
link is added or the site is translated. Replace the number with the measurement:

```typescript
r$.geometry('.site-nav', { wrapped: r$.whenWraps });
```
```css
.site-nav[data-wrapped]         { visibility: hidden; height: 0; overflow: hidden; }
.site-nav[data-wrapped] ~ .burger { display: block; }
```

Your CSS keeps owning the appearance; JS only states the fact. And delete the media query —
leaving both means two sources of truth.

**The spacing ladder with three visible jumps.** Three rules become one declaration that
compiles to a `clamp()` and ships as CSS:

```typescript
r$('.card', { padding: r$.fluid(12, 36) });
```

**A component that must answer to its container**, not the window — say how wide that container
gets, which is required and not optional:

```typescript
const panel = { container: true, from: 240, to: 820 };
r$('.card', { fontSize: r$.fluid(15, 26, panel) });
```

Re-run `verify` after each replacement. The contract you pinned in step 2 is now doing the job
it was written for.

## Step 5 — Let the constructs write the rules

Once the page runs the runtime, `init` reads more than the page:

```bash
npx @responsivejs/cli init https://your-site.com -o site.contract.json
```

Every fluid value you declared becomes a `monotonic` + `continuous` rule and a baseline: what
you *declared* becomes what CI *verifies*. Anything not yet expressible as a rule is printed,
never dropped silently.

## What not to do

- **Do not convert every media query.** Most of them are fine. The ones worth replacing are the
  ones that encode a guess about content — how many links fit, whether the text was cut.
- **Do not gate on a contract you have not read.** A generated file is a starting point.
- **Do not chase the aesthetic score.** It is a heuristic, off by default, and no substitute for
  the measurements.

→ [Troubleshooting](troubleshooting.md) when something does not behave · [Why r$](why.md) when
someone asks you to justify it.
