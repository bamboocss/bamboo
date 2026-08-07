---
'@bamboocss/preset-base': minor
'@bamboocss/core': minor
'@bamboocss/types': minor
---

Register composed custom properties with `@property` instead of resetting them on every element.

Utilities that build one declaration out of several variables — `filter` out of nine, `translate` out of its axes —
needed the variables nobody set to resolve to something harmless, and needed them not to inherit, since a parent's
`--blur` reaching its children is a leak rather than a default. Before `@property` the only way to say that was to
assign all of them a value on `*, ::before, ::after, ::backdrop`, which put 33 custom property declarations on every
element in the document.

`inherits: false` says it directly, and the initial value lives in the registration rather than in a declaration per
element.

## `customProperties` on a utility

A utility now declares the properties it composes, so the guarantee that a variable exists sits with the code that reads
it:

```ts
filter: {
  className: 'filter',
  values: { auto: 'var(--blur, ) var(--brightness, )' },
  customProperties: {
    '--blur': { syntax: '*', inherits: false },
    '--brightness': { syntax: '*', inherits: false },
  },
}
```

Registrations are merged across every configured utility, so a reader and a writer may both name the same variable; the
first declaration wins, so one utility cannot retype a variable another already registered. Third-party presets get the
behaviour by declaring it next to the utility, with no second list to keep in step.

Every registration is `syntax: '*'`. A type would let these transition, and would also make a value outside it fail
silently to the initial value rather than loudly — `translateX: '50%'` under `<length>` renders as `0`. Typing is worth
doing per variable, where the value space is known, not in bulk.

Omitting `initialValue` gives a property the guaranteed-invalid value, which is what a `var(--x, )` read expects: the
reference takes its own empty fallback and composes to nothing. That is what the old `/*-*/ /*-*/` sentinel bought,
without a declaration per element to buy it.

## What changed in the emitted CSS

The universal rule is gone, replaced by 32 `@property` rules. Against the 33 it declared:

- **`--rotate`, `--skew-x` and `--skew-y` are no longer declared.** No utility reads or writes them; they were left
  behind by utilities that no longer exist. Stylesheets referencing them directly should set their own.
- **`--rotate-z` and `--translate-z` are now declared.** `rotate: 'auto-3d'` and `translate: 'auto-3d'` compose them,
  but the reset never covered them — so they inherited, and a parent's value moved or rotated its descendants.

The three gradient stop positions are now read as `var(--gradient-from-position, )` rather than bare. A stop's position
is optional, and with no initial value a bare read would take the whole `--gradient-stops` declaration invalid at
computed-value time and drop the gradient.

## Fixes

`@property` emission no longer falls back to `initial-value: initial` when a definition declares no initial value. That
keyword is not "no initial value" — under the universal syntax it is a token, so it became the property's value and was
substituted into whatever composed it, turning `filter: var(--blur, ) …` into `filter: initial …`, which is invalid and
drops the whole filter. The descriptor is now omitted, which is what the spec asks for.

Generated types are unchanged: these registrations never reach `globalVars`, so `CssVars` and `CssVarKeys` keep the
shapes they had. Routing them through `globalVars` would have closed the `CssVars` union to those names and broken
`var(--anything)` on the ~100 properties whose type union has no string fallback.
