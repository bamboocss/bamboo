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
| runtime-perf |  -2.1% |  -1.9% |  -2.3% |
| vite-ts      |     0% |     0% |     0% |

`vite-ts` is the control: it does not call `token()` either, and nothing changes because its CSS genuinely reads the
tokens it declares. Only declarations nothing can reach go.

Those three are the ends of the range rather than the middle of it. Across all sixteen example apps the saving runs from
0% to 20.2% raw, with most between 11% and 19% — `next-js-app` -18.6%, `storybook` -17.0%, `remix` -15.9%, `qwik-ts`
-15.4%, `astro` -14.8%, `solid-ts` -13.6%, `waku-ts` -11.2%.

A project that calls `token()`, `token.var()`, or imports the tokens artifact anywhere under `include` is unaffected —
and a hand-written `var(--x)` in source was already covered by the existing reference scan.

Two shapes the scan does not see, both rare and neither loud. `include` scopes style extraction rather than everything
that may import, so a build script, a config file, or a sibling workspace package calling `token()` is not covered; nor
is a binding renamed away from `token`, as in `const t = token`. In both the declaration is pruned and the call returns
a `var()` nothing declares. `pruneUnusedTokens: false` keeps every declaration if you are in that position.
