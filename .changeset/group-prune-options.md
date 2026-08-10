---
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/config': minor
'@bamboocss/generator': minor
---

Group the three prune flags under `prune`, and rename the mode that was called `'strict'`.

```ts
// before
pruneUnusedTokens: 'strict'
pruneUnusedKeyframes: false
prunePreflight: true

// after
prune: { unresolved: 'error', keyframes: false, preflight: true }
```

Three options for one concept had drifted apart on all three of naming, default and value type: two said "Unused" and
one did not, two defaulted to `true` and one to `false`, one took a string and two did not. Each key is independent and
setting one keeps the defaults for the rest.

**`'strict'` is now `unresolved: 'error'`.** The word already meant something unrelated in the same config —
`strictTokens` and `strictPropertyValues` narrow generated _typescript_, and neither implies nor is implied by failing a
build over a token path. The option is now named for what it checks.

**`unresolved: 'warn'` is new.** It runs the same accounting as `'error'` and reports the same references without
failing the build, so a project can read what turning `'error'` on would reject before a build depends on the answer.
The pruning is identical either way — only whether an unreadable path stops the build differs.

**Upgrading.** A config still setting a removed option is now reported by name, with the replacement:

```
⚠️ Invalid config:
- [config] `pruneUnusedTokens: 'strict'` is now `prune: { unresolved: 'error' }`.
```

That check exists because an unknown config key was otherwise ignored in **silence** — there is no schema walk, so a
stale `pruneUnusedTokens: 'strict'` would have built clean, pruned by the default instead, and quietly stopped enforcing
the assertion it asked for. Set `validation: 'error'` to make it fail rather than warn.

Emitted css is unchanged for an equivalent config; verified byte-identical on three example apps.

Preset merging is per key: a preset setting `prune: { keyframes: false }` and an app setting
`prune: { preflight: true }` get both. That needed doing deliberately — `mergeConfigs` deep-merges only the options it
names and shallow-assigns the rest, so nesting three booleans into an object introduced a way for a preset's setting to
vanish because an app set a _different_ key. Nothing about the output would have shown it, so it is pinned by a test.
