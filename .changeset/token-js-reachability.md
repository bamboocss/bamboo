---
'@bamboocss/generator': minor
'@bamboocss/node': minor
---

Stop keeping token declarations for `token()` when nothing calls it.

Some declarations survive pruning purely so JavaScript can ask for them: virtual tokens, conditional ones, and the
positive counterpart of every negative token. That last case is the expensive one — a negative is never declared itself,
so it pins its positive and keeps the entire spacing scale alive whether or not anything uses it. The config
documentation put that at "roughly a third of what survives pruning", and said there was no opt-out.

There is now, and it needs no flag. The tokens artifact is generated into your project rather than installed, so the
import is written in your own source and a scan of `include` finds it. When no file reaches for a token from JavaScript,
the exemption has no caller to serve and is skipped.

This changes emitted CSS by default, which is why it is a minor rather than the patch it started as.

**What the scan looks for**

A call — `token(`, `token.var(`, with whatever whitespace a formatter left around the dot — or a `from` / `import` /
`require` of any module specifier carrying a `/tokens` path segment. Both tests over-match on purpose: keeping a
declaration nothing reads costs bytes, and dropping one that is read returns a `var()` nothing declares.

The import test is loose because the literal `styled-system/tokens` was too tight in three ways at once. `outdir` is
configurable, so the artifact is only at `styled-system/` by default; a tsconfig path alias spells it something else
again; and the artifact is a **directory**, so under NodeNext the only legal specifier is
`styled-system/tokens/index.mjs` — which the literal did not match either. It is still anchored to an import keyword,
because otherwise a URL or a route (`fetch('/api/tokens')`, an `href` of `/docs/theming/tokens`) reads as an import and
switches the whole optimisation off without saying so.

Measured on the sandboxes here:

| app          |    raw |   gzip | brotli |
| ------------ | -----: | -----: | -----: |
| svelte       | -20.2% | -12.9% | -12.2% |
| gatsby-ts    | -19.0% | -11.8% | -11.3% |
| next-js-app  | -18.6% | -11.7% | -10.8% |
| vite-ts      |  -6.9% |  -4.9% |  -4.1% |
| runtime-perf |  -2.0% |  -1.9% |  -1.9% |
| preact-ts    |     0% |     0% |     0% |

`preact-ts` is the control, and it is the shape you want to check yourself against: it calls `token()`, so the exemption
has a caller, nothing is skipped, and its stylesheet is byte-for-byte what it was. Every other app here reaches for no
token from JavaScript, and the spread between them is how much of their theme the CSS alone could not account for.

Across all sixteen example apps: 0% wherever a project reaches for a token, and -2.0% to -20.2% raw wherever none does,
most of them between -11% and -19%.

A project that calls `token()`, `token.var()`, or imports the tokens artifact anywhere under `include` is unaffected —
and a hand-written `var(--x)` in source was already covered by the existing reference scan.

Two shapes the scan does not see, both rare and neither loud. `include` scopes style extraction rather than everything
that may import, so a build script, a config file, or a sibling workspace package calling `token()` is not covered; nor
is a binding renamed away from `token`, as in `const t = token`. In both the declaration is pruned and the call returns
a `var()` nothing declares. `pruneUnusedTokens: false` keeps every declaration if you are in that position.
