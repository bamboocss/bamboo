---
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/generator': minor
---

Add `unresolvedToken`, so a style value naming a token that does not exist can fail the build.

```ts
export default defineConfig({
  unresolvedToken: 'error', // 'off' | 'warn' | 'error', default 'warn'
})
```

```
error: 2 style value(s) name a token that does not exist:

- `background: accent.default`. Check the path against your `colors` tokens.
- `color: brand.foreground`. Check the path against your `colors` tokens.
```

Token resolution falls back to the value it was given, so an unknown path is emitted as written and
`background: 'accent.default'` ships as `background: accent.default`. That parses, so the stylesheet is valid and no
build step objects — the browser drops the declaration at compute time and the style is simply absent. It had warned on
every build for months behind a dead site-wide `::selection` rule and a `_selected` state that rendered identically to
unselected, and there was no way to escalate it: `validation` grades the config rather than the source, `strictTokens`
narrows generated typescript, and `prune.unresolvedPath` is about a `token()` call the prune scan cannot follow — a
question about pruning coverage, asked of a token that usually exists.

The default stays `warn`, which is exactly what it did before, because the test is a _shape_: a dotted value against the
set of values the property enumerates. That is right about a mistyped token and cannot be certain about a literal, so
escalating is a choice a project makes once it knows its own source is clean. A property that enumerates nothing is
never reported, and `[accent.default]` marks a value as literal.

**Under `error` the check reads the decoded stylesheet, not the transforms that built it.** The decoder memoizes each
atom by hash, so on the second build of the same source `transform` is never re-entered — a check that accumulated
findings as transforms ran would either keep one past the edit that fixed it, or clear its record and then pass a build
whose source is still broken. Asking the sheet instead makes the question stateless and matches what is actually being
written: extraction is additive within a watch process, so a value you have already fixed is reported for exactly as
long as its rule is still in the file.
