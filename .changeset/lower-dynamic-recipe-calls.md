---
'@bamboocss/vite': minor
'@bamboocss/generator': minor
'@bamboocss/shared': patch
---

Lower inline recipe calls the build cannot resolve, so the recipe config leaves the bundle.

`badge({ tone })` where `tone` is a prop or state used to keep the whole recipe. Every class it can produce is knowable
— only _which one_ applies is not — so what ships is the choice:

```ts
// you write
const badge = cva({ base: { rounded: 'full' }, variants: { tone: { info: {…}, warn: {…} } } })
const cls = badge({ tone })

// the bundle gets
const cls = 'cva_1a2b3c' + cvaPick(tone, { info: ' cva_1a2b3c--tone_info', warn: ' cva_1a2b3c--tone_warn' })
```

`cvaPick` is a new export of the generated `cx` module — chosen because it pulls no engine — and is about 45 bytes. A
recipe's classes are **additive**, one per variant, so N runtime axes lower to N terms rather than to every combination
of their values.

**Measured end to end**, bundling a module with one dynamic recipe call:

|        | minified  | gzipped   |
| ------ | --------- | --------- |
| before | 10,347 B  | 4,034 B   |
| after  | **139 B** | **150 B** |

**The saving is the config, and it needs `/*#__PURE__*/` to happen at all.** `cva({ base, variants })` ships the whole
style object so the runtime can hash it into a name — but those styles are already in the stylesheet. Once every call of
a binding lowers, nothing reads it; a bundler still will not drop `cva(…)`, because it cannot prove the call is
side-effect free, so the build now annotates it. Without that annotation folding made modules **larger**: 10,347 →
10,447 B, classes added and nothing removed. The annotation is only emitted when every call of that binding lowered —
while one survives, the binding is still read.

Across an application with 1,271 inline recipe bindings, **1,024 lower completely**, freeing 62 kB gzipped of config
against 17 kB of added call sites.

**What still declines,** reported as `recipe-call`: a spread or computed key, whose selection cannot be enumerated; a
selection that could _run_ something, since folding deletes the argument; a config the build could not read; and slot
recipes, which resolve to one class per slot rather than a string.

**Classes are emitted in the config's variant order**, which is the order the runtime appends them — so a folded module
and a dev build produce the same `class` attribute rather than the same set in a different order.

`getRecipeClassNames` now looks variant values up as own keys. A value of `'toString'` or `'constructor'` previously
found `Object.prototype`'s member, passed the null check and named a class no rule backs; both sides now agree it
selects nothing.
