---
'@bamboocss/vite': minor
'@bamboocss/core': patch
---

Add `@bamboocss/vite`, with opt-in build-time source transformation.

During a production build the plugin rewrites statically-resolvable `css()` and pattern calls into the class string they
would have returned, so those calls cost nothing at runtime:

```tsx
// you write
export const title = css({ fontSize: 'lg', fontWeight: 'bold' })

// the bundle gets
export const title = 'fs_lg fw_bold'
```

CSS output is unchanged — only the JavaScript changes. It is **off by default** and build-only:

```ts
// vite.config.ts
import bamboocss from '@bamboocss/vite'

export default defineConfig({
  plugins: [bamboocss({ transform: true })],
})
```

The plugin does not emit CSS. Keep your existing PostCSS setup for that.

Values composed across files fold too, since the extractor already resolves them — an imported `css.raw()` value, a
plain exported object, an aliased import, or a pure local helper including an IIFE. When a fold reads from another
module the plugin registers it as a watch dependency, so editing that module re-transforms its consumers instead of
leaving a stale literal behind.

Only fully static call sites fold. Anything else is left byte-identical: runtime values, ternaries, computed keys,
spreads of anything but an inline object literal, and calls where any one argument is dynamic. `css.raw()` and the other
`.raw()` variants never fold because they must keep returning a style object; `cva()`, `sva()`, and `token()` never fold
because they do not evaluate to a class string. Set `reportSkipped: true` to have every declined call reported with a
reason.

Folded strings are computed through the same runtime `css` the app would have called, rebuilt in-process from the
resolved config, so the substitution is behaviour-preserving by construction. Every folded class is separately asserted
to be backed by a rule in the emitted CSS.

Where this pays off: a cache miss costs ~3.1µs against ~66ns warm, and nested styles never reach the fast memoization
path — a component with a condition and a responsive value costs ~437ns per call even fully cached. Folding removes that
work rather than caching it. The runtime itself still ships, since dropping it would require every call site in the
module graph to fold.

Build only. Folding re-parses each module with `ts-morph` — measured at ~0.3ms for a small component and ~3ms for a
147-line file with 24 call sites on `sandbox/vite-ts`, with the parse dominating and the fold adding ~10% on top. That
amortizes across a build; on every hot update it would not, and a dev bundle gains nothing from pre-resolved style
calls.

Also scopes `RuleProcessor`'s `css`/`grouped`/`cva`/`sva`/`recipe` results to the call that produced them. They
previously reported every class name the decoder had accumulated, which is correct for a processor used once and wrong
for one shared across call sites. No change to CSS output or to any single-call result.
