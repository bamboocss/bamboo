---
'@bamboocss/core': minor
'@bamboocss/preset-base': minor
---

Emit breakpoints and container queries in CSS Media Queries Level 4 range syntax.

```diff
- @media screen and (min-width: 48rem) { … }                              /* md */
+ @media (width >= 48rem) { … }
- @media screen and (min-width: 48rem) and (max-width: 63.9975rem) { … }  /* mdOnly */
+ @media (width >= 48rem) and (width < 64rem) { … }
- @media screen and (max-width: 47.9975rem) { … }                         /* mdDown */
+ @media (width < 48rem) { … }
```

The `63.9975rem` was the next breakpoint stepped down by 0.04px, because `max-width` is inclusive and the old syntax has
no inclusive/exclusive pair. That step cost two things. Viewports inside the 0.04px gap matched neither range — small
enough to never show up on a device anyone tests on, and real. And stepping down needs arithmetic, so a breakpoint in a
unit that does not convert to pixels (`vw`, `ch`, a `calc()`) had to be emitted unstepped and overlapped its neighbour
by a whole unit. An exclusive `<` says the same thing exactly, in any unit, with no arithmetic — so both are gone, and
the overlap noted in the preceding changeset no longer applies.

Container queries move to the same construction:

```diff
- @container card (min-width: 40rem) { … }
+ @container card (inline-size >= 40rem) { … }
```

`inline-size` is what a container query is actually asking about — it and `width` diverge the moment a container is in a
vertical writing mode.

**What changes for you**

- **Emitted CSS changes** for every responsive and container style. Class names and hashes are unchanged.
- **Responsive styles now apply when printing.** `@media screen and (min-width: 48rem)` never matched print;
  `@media (width >= 48rem)` matches it against the page width. Every breakpoint-conditioned declaration now participates
  in print output. If you relied on breakpoints being screen-only, scope those rules with an explicit `@media screen` or
  a `_print` condition.
- **Browser baseline rises to Chrome 104+, Safari 16.4+, Firefox 102+.** Enabling
  [`lightningcss`](https://bamboocss.com/docs/references/config#lightningcss) lowers these queries against your
  browserslist targets, but only partly recovers the old baseline: the `min` half round-trips to `(min-width: X)`, while
  an exclusive upper bound has no MQ3 spelling and lowers to `not (min-width: Y)` — itself MQ4. So `smDown`, `mdOnly`,
  `mdToXl` and `hideBelow` need roughly Chrome 88 / Safari 14 / Firefox 64 even with lowering on.
- **`hideBelow` with an arbitrary value is now exclusive.** `hideBelow="800px"` emitted `(max-width: 800px)` and now
  emits `(width < 800px)`, which is what the token form (`hideBelow="md"`) always meant. The two disagreed at exactly
  the bound.
- **Container rules now sort ahead of every `Down` breakpoint rule, at any width.** Container queries carried no
  readable bound before — their sort key was a bare size like ` 40rem` — so they ranked below anything the sorter could
  classify. They now carry `inline-size >= …` and join the `min` group, which sorts ahead of every `max`-bounded rule.
  Where a container rule and a `Down` breakpoint rule set the same property on the same element, the `Down` rule now
  wins where the container rule used to.
- **Rules whose media queries tie on computed width may reorder.** Two queries that resolve to the same pixel width but
  are spelled differently — `48rem` against `48em`, or the `md` breakpoint against the `3xl` container size, both 768px
  — have no bound to separate them, so the sorter compares the strings. The strings changed, so those ties resolve
  differently.

**New**

Container sizes gain the range set breakpoints already had: `@/mdOnly`, `@/mdDown` and `@/mdToXl` alongside `@/md`. With
the 12 sizes in `preset-bamboo` and one named container this takes the generated container conditions from 24 to 204,
since the `To` spans are quadratic in the size count. That count reaches shipped output: every condition key is joined
into `css/conditions.mjs` and becomes a member of the generated `Conditions` interface, which `ConditionalValue` and
`Nested` map over. Trim `theme.containerSizes` if the type surface matters more to you than the range keys.

**Fixed**

Scale entries are ordered by their converted pixel value rather than their leading digits, so `30rem` no longer sorts
below `400px`. Ordering only affected the `min` bound before, which is monotonic either way; it decides the upper bound
of every `Only` and `To` range now, and getting it wrong inverts the range so it matches nothing. `validateBreakpoints`
rejects a mixed-unit theme, but `theme.containerSizes` has no equivalent check and reaches the same code.
