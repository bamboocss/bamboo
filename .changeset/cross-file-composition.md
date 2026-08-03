---
'@bamboocss/extractor': minor
'@bamboocss/parser': minor
---

Extract styles composed across files. A named import whose value is static now folds at the call site:

```ts
// styles.ts
export const button = css.raw({ display: 'inline-flex', paddingInline: '4' })

// button.tsx
import { button } from './styles'
css(button, { background: 'blue.500' }) // now emits the button styles too
```

Previously the imported half resolved to nothing and was silently dropped, so only the inline object produced CSS.

Supported: named imports, aliased named imports, re-exports, file-local alias chains, plain exported objects,
`css.raw()` values, and imported values spread into objects or nested selectors. Not supported, and skipped without
error: default imports, namespace imports, and values that are only known at runtime.

Aliased named imports (`import { button as btn }`) were additionally never resolved even when file traversal was enabled
— the lookup used the local binding name rather than the exported one.
