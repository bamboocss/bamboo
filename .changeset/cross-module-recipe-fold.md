---
'@bamboocss/parser': minor
'@bamboocss/types': minor
'@bamboocss/vite': minor
---

Fold calls of a recipe declared in another module.

`const badge = cva(...)` was recognised by the name the _file_ bound, so a recipe declared in `app/styles.ts` and called
anywhere else matched nothing. Those calls were not declined — they were invisible: the extractor never recorded them,
the fold never saw them, and they appeared in neither the folded nor the skipped tally. A build could report no unfolded
calls while shipping hundreds of them, which made `strict` untrustworthy rather than merely incomplete.

The parser now also registers recipe bindings that arrive through an import, following `export { x } from './m'`,
`export * from './m'`, `import { x } … export { x }`, and an alias at either end to the module that declares the recipe.
A star export contributes only names nothing else exports, as the language does. It records that origin on the call, and
the fold pulls the config from there — on demand rather than from a registry accumulated during the build, since a
bundler transforms a consumer before the module it imports and a registry would make the result depend on discovery
order. The class names are hashed from the config, so a recipe lowered in a consuming module produces exactly the string
its own module produces.

Not followed: a namespace import (`import * as s`, then `s.textInput(...)`), a default export, and a recipe declared
outside the project's `include`. Each stays neither folded nor reported, as every cross-module call did before.

Resolution is a syntax walk over already-loaded statements, using the caller's module resolver. Going through the symbol
table instead — `getModuleSpecifierSourceFile`, or a symbol's aliases — forces `initializeTypeChecker` and measured 4.5x
on `parse only`.

`ensureRecipeHelperImport` now writes an import declaration when the file has none to extend, which is the ordinary case
once a recipe can come from elsewhere: such a file imports the binding, not the factory, so it need not import the css
module at all. The declaration goes after the last existing import, leaving a `'use client'` prologue first.
