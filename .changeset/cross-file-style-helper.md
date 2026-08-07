---
'@bamboocss/extractor': minor
---

Resolve a style helper called from another module, instead of silently dropping what it returns.

```jsx
// helpers.ts
export const focusRing = (options = {}) => {
  const { color, width } = { ...defaults, ...options }
  return { _focusVisible: { outlineColor: color, outlineWidth: width } }
}

// Link.tsx
css({ ...focusRing({ color: 'labs.blue.40' }), color: 'red' })
```

The spread came back empty and those declarations never reached the stylesheet — no error, no warning, just a component
missing its focus ring. Calling the same helper from _within_ the file always worked, which is what made this hard to
see: the pattern looks identical and only the import boundary decides.

The evaluator was given no type checker, so it could not follow an import to a declaration. It has one now.

For `css()` this was a partial loss — everything else in the call still applied. For a `cva`/`sva` it is not: the
classes are named from a hash of the config, so a dropped declaration gives the build and the browser different names
and the element renders with **no styles at all**.

**The boundary is the project.** A call that resolves into `node_modules` is still left alone — a dependency's code is
not ours to run at build time, however pure it looks. That is unchanged behaviour, not a new restriction.

The checker is passed only for a call that resolves within the project. Handing it to the evaluator unconditionally cost
a third again on a file of plain `css()` calls, which is most files; narrowed this way, a file that does not use the
pattern measures the same as before (median of 5 × 200 parses: 0.494 ms before, 0.480 ms after).
