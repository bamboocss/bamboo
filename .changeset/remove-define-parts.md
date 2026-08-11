---
'@bamboocss/dev': minor
'@bamboocss/types': minor
'@bamboocss/generator': minor
'@bamboocss/eslint-plugin': minor
---

Remove `defineParts`, leaving one way to model a multi-part component.

A slot recipe is that way. Where you wanted the other thing `defineParts` offered — a single class on the root that
reaches its children, so there is nothing to bind — that was never an API, only an object whose keys are selectors:

```ts
defineRecipe({
  className: 'checkbox',
  base: {
    '& [data-part="root"]': { display: 'flex', alignItems: 'center', gap: '2' },
    '& [data-part="control"]': { borderWidth: '1px', borderRadius: 'sm' },
  },
})
```

`defineParts` only keyed that object by part name instead. It earned its place when the selectors came from a Zag or Ark
`anatomy` and were tedious to spell out — `&[data-scope="card"][data-part="root"], & [data-scope=…]` per part. That case
is still real, and still a few lines that belong in your codebase rather than in the framework:

```ts
const toParts =
  <T extends Record<string, { selector: string }>>(anatomy: T) =>
  (config: Partial<Record<keyof T, SystemStyleObject>>): SystemStyleObject =>
    Object.fromEntries(Object.entries(config).map(([part, styles]) => [anatomy[part].selector, styles]))
```

The `Part` and `Parts` types go with it, as does the `defineParts` declaration in the generated `styled-system/types`.

`no-config-function-in-source` also picks up `defineMixins` and drops `defineLayerStyles` and `defineTextStyles`, which
the preceding mixins change had left behind — writing `defineMixins` in a source file was not being flagged.
