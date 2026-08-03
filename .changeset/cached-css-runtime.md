---
'@bamboocss/generator': patch
'@bamboocss/shared': patch
---

Cache `css()` and pattern class names in the generated runtime, and stop `css.raw()` sharing a mutable object.

`memo` now keys flat arguments on a structural hash confirmed by an exact comparison, falling back to `JSON.stringify`
only for nested styles. Repeated `css()` calls get roughly 4-5x faster, multi-argument calls about 4x, and pattern
helpers — which were not memoized at all — about 1.3x. Class name output is unchanged.

Two behaviour changes worth knowing about:

- The cache is now **bounded**. It previously grew for the lifetime of the process, which leaked in long-lived SSR
  workers (~16MB retained after 50k distinct styles, versus ~3MB now). The trade is that a workload whose set of
  distinct styles exceeds the bound no longer benefits from caching, and is slower than it was; a workload that reuses
  styles — the reason the cache exists — is substantially faster.
- `css.raw()` returns a fresh object. It previously handed every caller the same cached instance, so a caller mutating
  what it received corrupted the cache and the class names produced afterwards. The copy is shallow, so mutating a
  nested condition object inside a `raw()` result still reaches shared state.
