---
'@bamboocss/shared': patch
---

Stop the generated runtime's memo treating differently-shaped arguments as equal.

Cached arguments were compared as a flat bag of key/value pairs enumerated with `for...in`, which diverges from what the
memoized functions actually read in two ways:

- An array and an object with the same numeric keys enumerate identically, so `['x']` and `{ 0: 'x' }` shared a cache
  entry.
- `for...in` walks the prototype chain, so an object with inherited enumerable properties was compared as though it
  owned them, while `Object.keys` and `JSON.stringify` see nothing.

In both cases the second caller received a result computed from the first caller's arguments. No user-reachable
miscompilation was found — style objects reaching that path are plain, and arrays of styles or responsive values are
nested and take a different route — but the guarantee the memo documents was not one it kept, and the failure would
surface as an inexplicable class name.

Arrays are now distinguished from objects, and any value carrying a custom prototype is keyed by serialization instead,
which sees exactly what the wrapped function does.
