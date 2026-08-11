---
'@bamboocss/node': minor
'@bamboocss/types': minor
---

Add `prune.keepTokens`, so a token path the build cannot follow costs a category instead of the whole theme.

```ts
prune: { tokens: 'accounted', keepTokens: ['colors.*'] }
```

`accounted`'s fallback was total: **one** reference the accounting could not follow kept every declaration in the
project, so a codebase with a single `token(key)` in it shipped the same stylesheet as one that never pruned. There was
no middle ground between that and asserting every path resolves — which put the feature out of reach of the codebases
that reach for `token()` most.

`keepTokens` is the bound the build could not infer, written by hand. Under `accounted` it keeps what it matches **and**
stands in for what could not be followed, in place of the blanket keep. Measured on `sandbox/vite-ts` with one
unfollowable `token(key)`:

| setting                                             | declarations | stylesheet |
| --------------------------------------------------- | -----------: | ---------: |
| `tokens: 'reachable'`                               |          426 |   23,412 B |
| `tokens: 'accounted'`                               |          426 |   23,412 B |
| `tokens: 'accounted', keepTokens: ['colors.*']`     |          270 |   17,867 B |
| `tokens: 'accounted', keepTokens: ['colors.red.*']` |           51 |   10,649 B |

Patterns are anchored globs over the dotted token _path_, with `*` for any run of characters and a leading `!` to
exclude. The path, not the css variable: a token is `fontSizes.3xl` and its declaration is `--font-sizes-3xl`, so
`font-sizes.*` matches nothing. A pattern matching no token is reported and names the spelling that would have worked,
because it is nearly always a typo and keeping nothing is otherwise silent; so is a list holding only exclusions, which
selects everything they do not name.

Saying `keepTokens: ['colors.*']` is an assertion about your own code — _the reads you cannot follow land in colours_ —
which is why nothing infers it. Nothing verifies it either, so the covered references are still printed under `warn`.
`unresolvedPath: 'error'` deliberately does **not** combine with it: one asserts every path resolves and the other
declares where the ones that do not will land, and the build says which to drop rather than silently preferring the
weaker claim.

Under `reachable` it is additive only, for a token nothing in the stylesheet references and no javascript here reads — a
sibling package consuming the output, or css outside `include`.

This replaces `staticCss` as the way to keep a token category alive. `staticCss` emits utility _classes_: keeping the
colours meant shipping a rule per colour purely to hold the declarations up, usually a larger stylesheet than the
pruning saved. `CssRule.properties` also has no documented wildcard, so every value had to be enumerated by hand.

**Docs.** The `prune` reference had not caught up with the option renames — it documented `prune.unresolved`,
`tokens: false` and the wrong default for `unresolvedPath`. It also never mentioned that a template literal is **bounded
rather than declined**: ``token(`colors.${shade}`)`` keeps the `colors` category and prunes everything else, which
already covers the commonest dynamic read and is worth knowing before concluding `accounted` is unusable.
