---
'@bamboocss/eslint-plugin': minor
---

Add `require-recipe-class-name`, warning on a recipe whose class names depend on what the build could read.

A `cva`/`sva` with no `className` is named by hashing its config, and that name is derived twice — the build hashes the
config it could **read**, the browser hashes the one it **holds**. Anything the build cannot resolve makes those two
objects differ, so the element carries classes no rule was emitted under and renders with no styles at all.

```jsx
// ⚠️ the build cannot resolve the spread, so it hashes a different object
const button = cva({ base: { ...getFocusRingStyles(), padding: '4' } })

// ✅ the identity short-circuits on the name and never hashes the styles
const button = cva({ className: 'button', base: { ...getFocusRingStyles(), padding: '4' } })
```

Naming the recipe removes the failure rather than banning the pattern: a declaration the build could not read then costs
only itself, which is what it cost before recipes were named semantically. Readable class names come with it.

`mode: 'dynamic-only'` — what `recommended` enables — narrows it to configs that are not plain static literals, which is
where the divergence is possible. `mode: 'always'` requires a name everywhere.

This is the editor-time half of the build warning for an unreadable recipe config. It needs no extraction, so it fires
before a build runs and catches shapes the build check cannot see.
