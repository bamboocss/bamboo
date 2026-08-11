---
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/generator': minor
'@bamboocss/config': minor
'@bamboocss/dev': minor
'@bamboocss/preset-bamboo': minor
'@bamboocss/preset-atlaskit': minor
'@bamboocss/mcp': minor
---

Replace `textStyles`, `layerStyles` and `animationStyles` with one `theme.mixins`.

The three were one mechanism wearing three names: one registration, one cascade layer, and a `{ description?, value }`
shape they all shared. They differed only in which css properties the value was allowed to set — a partition that was
arbitrary at the edges (`color` was legal in a text style _and_ a layer style; `transform` in a layer style but
`transformOrigin` only in an animation style) and costly in the middle, since a bundle wanting a font _and_ a border had
to be split across two keys and applied twice.

```ts
// before
export default defineConfig({ theme: { textStyles, layerStyles, animationStyles } })
css({ textStyle: 'body' })
css({ layerStyle: 'card' })

// after
export default defineConfig({ theme: { mixins } })
css({ mixin: 'body' })
css({ mixin: 'card' })
```

- `defineTextStyles`, `defineLayerStyles` and `defineAnimationStyles` become `defineMixins`.
- The `text-styles.json`, `layer-styles.json` and `animation-styles.json` specs become `mixins.json`, and the MCP tools
  `get_text_styles`, `get_layer_styles` and `get_animation_styles` become `get_mixins`.
- Setting a property that does not exist is still an error. `Mixin` is built on the same property set `css()` uses
  rather than on `SystemStyleObject`, whose index signature would accept a typo — which is what the three allowlists
  were really protecting, and why one of them shipped `hypens` for as long as it did.
- One namespace now holds every mixin, so prefix them by purpose — `text.body`, `layer.card` — if the flat list gets
  long. Nesting already supports this, and `DEFAULT` gives each group a bare name.

A config still setting one of the three old keys fails with the replacement named, rather than reverting to the default
in silence.
