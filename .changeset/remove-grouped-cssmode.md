---
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/node': minor
'@bamboocss/parser': minor
'@bamboocss/shared': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
---

Remove `cssMode: 'grouped'`.

**This is a breaking change released as a minor.** Bamboo is still pre-1.0 in practice, so the version does not carry
the signal — read the migration below before upgrading. A config setting `cssMode` will fail to typecheck, and
`bamboocss()` from `@bamboocss/vite` now returns an array of plugins rather than one.

Use `cva({ base: { ... } })` where you want one class per element instead of one per property. It already does exactly
that, and it does it better.

**Why**

Measured on a production build of a real app — the same source built both ways:

|           |   CSS raw | CSS gzip |
| --------- | --------: | -------: |
| `atomic`  | 1,411,989 |  209,489 |
| `grouped` | 2,913,254 |  390,428 |

**+86% gzipped**, entirely in the `utilities` layer, which goes from 673 kB to 2.17 MB. Grouping pays only where a style
set lands on many elements; it groups every `css()` call, and most of them are one-offs where a group is one rule
serving one element with nothing to amortise it against.

The markup saving cannot repay that. Across eight routes of the same app, grouping saved 1.9 bytes of gzipped markup per
element rendered — so roughly **95,000 elements** have to render before the stylesheet's extra 181 kB is earned back,
about 112 page views with a warm cache. The documentation claimed the trade favoured SSR and SSG; the app measured here
is server-rendered and never comes close.

**What to use instead**

A variant-less `cva` emits a single class carrying every declaration:

```ts
const row = cva({ base: { display: 'flex', alignItems: 'center', gap: '4' } })
// .cva_gphwnw { display: flex; align-items: center; gap: var(--spacing-4) }
```

It lands in the `recipes` layer rather than `utilities`, which is the part `cssMode` got wrong. Because
`@layer reset, base, tokens, recipes, utilities` puts `utilities` last, a consumer's `css()` override beats it
deterministically in every build — where a grouped `css()` class sat in `utilities` alongside the atoms it competed
with, leaving conflicts to source order.

The rule of thumb is the useful part: **if a style set is worth grouping, it is worth naming.** Grouping pays when a set
is reused, and a reused set is a component.

**Also removed**

- `RuleProcessor.grouped()` and the `GroupedRule` type.
- `groupClassName` from `@bamboocss/shared`, and the `grouped` / `knownGroups` fields on `CreateCssContext`.
- The generated `groups` artifact (`styled-system/css/groups.mjs`) — delete it if a stale copy is left in your output
  directory.
- The `'ambiguous-merge'` and `'too-many-combinations'` unresolved-style reasons, which only ever applied to grouping,
  and the `'grouped'` value of `UnresolvedStyle['kind']`.

`css()` calls the build cannot fully read are still reported, unchanged: a spread or computed key warns with a file and
line, because it looks static and is not.
