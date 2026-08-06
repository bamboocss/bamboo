---
'@bamboocss/extractor': minor
'@bamboocss/generator': minor
'@bamboocss/config': minor
'@bamboocss/parser': minor
'@bamboocss/shared': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/vite': minor
'@bamboocss/dev': minor
---

**Breaking:** remove template literal syntax.

The `syntax` config option is gone, along with the `--syntax` CLI flag and the syntax question `bamboo init -i` asked.
Styles are written as objects.

A project that set `syntax: 'template-literal'` now gets a TypeScript error on the option, and its tagged templates are
no longer read by the extractor — `` css`color: red;` `` and `` styled.div`color: red;` `` produce no CSS. Convert them
to object literals:

```tsx
// before
const One = styled.div`
  display: flex;
  width: 300px;
`

// after
const One = styled('div', {
  base: {
    display: 'flex',
    width: '300px',
  },
})
```

Everything the option gated goes with it: the string-literal `css`/`conditions` runtimes and the string-literal JSX
factories and types for all five frameworks, the parser's tagged-template branch, the extractor's `taggedTemplates`
matcher, the vite fold's tagged-template path, and `astish` from `@bamboocss/shared`. Under the object syntax `cva`,
`sva`, patterns, `is-valid-prop`, style props and `viewTransition()` were already the only paths taken, so their
generated output is unchanged — the codegen artifacts are byte-identical.
