---
'@bamboocss/config': minor
'@bamboocss/types': minor
'@bamboocss/fixture': minor
'@bamboocss/node': minor
---

Remove the top-level `hooks` config option, so a hook has one place to live.

Hooks were registrable two ways — through `plugins`, or through a bare `hooks` key on the config, which was treated as a
nameless plugin appended after all the others. Write a plugin:

```ts
export default defineConfig({
  plugins: [
    {
      name: 'my-app',
      hooks: {
        'tokens:created': ({ configure }) => configure({ formatTokenName: (path) => '$' + path.join('-') }),
      },
    },
  ],
})
```

One mechanism with two spellings also meant an ordering rule you had to know — "plugins in sequence, then the config's
own last" — and a diagnostic layer that had a name to print for one spelling and nothing for the other. Ordering is now
just the order of the array, and every hook belongs to something named.

A config still setting `hooks` fails naming the replacement, like any other removed option, rather than reverting to the
default in silence.

Internally the merged hooks no longer travel on the config object. They were written onto it by `mergeConfigs` and read
back off in `resolveConfig`, which is what made a `hooks` key ambiguous between "what you wrote" and "what resolution
produced"; `plugins` is the only source, so `resolveConfig` merges them once and keeps them on `LoadConfigResult`.
`createContext` from `@bamboocss/fixture` reads hooks from `plugins` for the same reason.
