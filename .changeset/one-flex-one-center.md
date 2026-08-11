---
'@bamboocss/preset-base': minor
---

Collapse the pattern set from 18 to 12, removing the ones that were another pattern with defaults frozen.

`stack`, `hstack`, `vstack` and `wrap` were all `flex`. Write the default you want instead — and note the 8px gap they
applied for you is now yours to choose:

```ts
flex({ direction: 'column', gap: '8px' }) // was stack()
flex({ align: 'center', gap: '8px' }) // was hstack()
flex({ direction: 'column', align: 'center', gap: '8px' }) // was vstack()
flex({ wrap: 'wrap', gap: '8px' }) // was wrap()
```

`square` and `circle` were `center` with a size, which `center` now takes:

```ts
center({ size: '12' }) // was square({ size: '12' })
center({ size: '12', borderRadius: 'full' }) // was circle({ size: '12' })
```

`cq` renamed two props onto `containerType` and `containerName` and defaulted the first. `containerName` is already a
utility typed against the `containerNames` theme key, so write the declarations:

```ts
css({ containerType: 'inline-size', containerName: 'sidebar' }) // was cq({ name: 'sidebar' })
```

`center` gains `size`, which sets `width` and `height` together and pins `flex: 0 0 auto` so a flex parent cannot shrink
the result. An unsized `center` is unchanged.
