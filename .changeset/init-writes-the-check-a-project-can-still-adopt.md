---
'@bamboocss/dev': minor
'@bamboocss/generator': patch
---

`bamboo init` now writes `strictTokens: 'unknown-tokens'`, and a modifier no longer depends on how a utility is
declared.

The default is the setting a project keeps. Unchecked, `css({ color: 'mutedd' })` type-checks, builds, and ships
`color: mutedd` — which parses, so nothing objects and the browser drops it at compute time; it surfaces as a colour
that never applied, a long way from the typo. `true` catches it and rejects every raw CSS value with it, which is 468
errors on one five-page app, so it is realistically a day-one decision and a project that did not make it then never
will. `'unknown-tokens'` costs no migration — every literal value stays writable — and what it rejects is a bare
identifier that names neither a token nor a keyword the property enumerates.

Run across this repo's own documentation site it reported four, all real: `zIndex: 'overlay'` and two `zIndex: 'modal'`
against a theme that declares no `zIndex` tokens, and a `transform: 'auto'` that is not CSS. All four emit a declaration
the browser discards. A project created by `init` has nothing written yet, so it starts at zero either way — the default
only decides whether the check is there when the first typo is.

Declining still works and is not the same as saying nothing: `bamboo init --no-strict-tokens`, or "Not at all" in the
prompt, leaves the key out. The config default is unchanged — an existing config that never mentions `strictTokens` is
still unchecked.

That run also turned up a false positive, which is fixed here rather than shipped as a default:

```ts
css({ rounded: 'lg!' }) //        ✅
css({ roundedBottom: 'lg!' }) //  ❌ was a type error
```

Both emit `var(--radii-lg) !important`. `WithModifier` tested `[T] extends [string]` before distributing, and
`KnownKeywords` keeps `Number` deliberately — a number cannot be a misspelled token path — so a utility declared as
`Tokens["radii"] | KnownKeywords<…>` had one non-string member and lost every modifier form for the whole property,
while its plain sibling kept them. It now filters with `Extract<T, string>`, which distributes over the same string
members and yields `never` for the same empty case, so the union this expands into is the size it always was and the
`& { __modifier?: true }` brand behind the 12.8x note is untouched.
