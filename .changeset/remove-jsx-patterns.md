---
'@bamboocss/preset-base': minor
'@bamboocss/eslint-plugin': minor
'@bamboocss/generator': minor
'@bamboocss/config': minor
'@bamboocss/parser': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/vite': minor
---

**Breaking:** remove JSX pattern components.

`styled-system/jsx` no longer emits a component per pattern — `<Stack>`, `<Box>`, `<HStack>` and the rest are gone, and
`styled-system/jsx` now exports only the factory, `isCssProperty` and `createStyleContext`.

Pattern **functions** are unchanged. Every pattern still ships from `styled-system/patterns`, and a pattern function
passes arbitrary style props through, so the rewrite is mechanical and behaviour-preserving:

```tsx
// before
<Stack gap="4" mt="8">{children}</Stack>
<Box p="4">{children}</Box>

// after
<div className={stack({ gap: '4', mt: '8' })}>{children}</div>
<div className={css({ p: '4' })}>{children}</div>
```

The `jsx`, `jsxName` and `jsxElement` fields on a pattern config are removed along with them — they only ever described
a component bamboo generated. `jsx` on a **recipe** is untouched.

Everything that existed to serve the component layer goes with it: the five per-framework pattern generators, the
`jsx-patterns` artifact, the parser's `jsx-pattern` result type and `JsxEngine`'s pattern matcher, and the vite fold's
pattern-element path. `Patterns.find`/`Patterns.filter` (both keyed by JSX name) are gone, and
`StyleEncoder.processPattern` takes `(name, props, grouped)`.

Two consequences worth knowing:

- A component of your own named `Box` or `Stack` is no longer misread as bamboo's pattern. It extracts as an ordinary
  component, which is what it always was.
- The `jsx-patterns-index` artifact is now `jsx-index`, since it no longer indexes patterns.
