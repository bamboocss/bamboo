---
'@bamboocss/core': patch
'@bamboocss/generator': patch
---

Grade the styles a config supplies under `unresolvedToken`, instead of going silent on them under `error`.

`globalCss`, the preflight scope, config recipes and mixins reach the sheet through `transformStyles`, which decodes
into a _clone_ of the decoder — so their atoms never enter `decoder.atomic`, which is the set `error` reads. Because
`error` also suppresses the warning in favour of that read, setting the option to the value that exists to escalate an
unresolved token made those styles **quieter than leaving it unset**:

```ts
export default defineConfig({
  globalCss: { body: { background: 'accent.default' } }, // no such token
})
```

Unset, that warned. With `unresolvedToken: 'error'`, no warning, exit 0, and the dead declaration still in `styles.css`
— the one setting that promised to fail on it was the one setting that could not see it. A typo in a config recipe's
base or variant behaved the same way. Only `css()` call sites and `staticCss` were ever graded, because only those go
through the real decoder.

The finding is now recorded where it is first visible, as the value is transformed, and `error` fails on that set
together with the sheet it already read. Both halves key on the resolved property and the bare token path, so an atomic
style — which passes through both, being transformed once before the decoder memoizes it — is one finding rather than
two.

Accumulating is what the earlier design deliberately avoided, and it stays avoided for the half that needed it. Atomic
styles are still read off the finished sheet: the decoder memoizes each atom by hash, so a rebuild never re-enters
`transform`, and a record of what transforms saw would either outlive the edit that fixed it or be cleared and never
refilled. The config half has neither problem, because a config is fixed for a context's lifetime — it is transformed
once when the context is built, and editing it constructs a new context. A record cleared per build would have reported
these on the first build and passed every build after it.

`warn` and `off` are unchanged, in output and in cost. Under `error` the shape test now runs per transformed value
rather than not at all, which is the cost `warn` already paid.
