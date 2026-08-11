---
'@bamboocss/config': minor
'@bamboocss/types': minor
---

Throw on a config option that no longer exists, instead of warning about it.

```
ERR_BAMBOO_CONFIG_ERROR: 2 config option(s) no longer exist:

- [config] `pruneUnusedTokens` is now `prune: { tokens: 'reachable' }`.
- [config] `themes` is now `theme.variants`.
```

Removed-option detection reported every key by name with its replacement, and then warned. A warning is not a signal
anything acts on: these removals ship in **minor** versions, so a warning is precisely what an automated dependency
upgrade merges without a person ever reading it — while the option itself is silent in every other way. There is no
schema walk, so a key that no longer exists is otherwise ignored outright, the build reverts to the default, and any
assertion the option asked for stops being enforced.

This is separate from unknown-key tolerance, which is unchanged. An unknown key may be forward-compatible — a setting
for a version not installed yet. A _removed_ key can only point backwards: it is proof the config predates the version
reading it.

Not governed by `validation`, in either direction, for the same reason a retired token spelling is not. That option
grades opinions about a config that still builds; this is evidence the config is not the one being read. Every
occurrence is collected before throwing, so a config is fixed in one pass, and the checks run ahead of the ordinary
findings — a config that predates the version is why the rest disagrees.

Found one in this repository: `sandbox/waku-ts` still set `themes`, so the app's theme variants were never generated
while it imported `getTheme` and `injectTheme` from them.
