---
'@bamboocss/shared': patch
'@bamboocss/generator': patch
---

Stop `cva.raw()`, `sva.raw()` and `css.raw()` handing out shared, mutable style objects.

Merged results are cached, so returning one directly means a caller that mutates what it received changes what every
later caller reads:

```js
const styles = button.raw({ size: 'sm' })
styles.color = 'red' // used to poison the cached entry
button.raw({ size: 'sm' }) // every later caller saw color: 'red'
```

`css.raw()` already copied, but only at the top level, and the merge underneath kept references to the caller's nested
objects — so a condition object such as `_hover` was shared even through that copy. Merging now copies nested objects
and arrays instead of pointing at the source, and all three `raw()` helpers return a fully independent object.

Class name output is unchanged.
