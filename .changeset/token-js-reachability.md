---
'@bamboocss/generator': patch
'@bamboocss/node': patch
---

Stop keeping token declarations for `token()` when nothing calls it.

Some declarations survive pruning purely so JavaScript can ask for them: virtual tokens, conditional ones, and the
positive counterpart of every negative token. That last case is the expensive one — a negative is never declared itself,
so it pins its positive and keeps the entire spacing scale alive whether or not anything uses it. The config
documentation put that at "roughly a third of what survives pruning", and said there was no opt-out.

There is now, and it needs no flag. `styled-system/tokens` is generated into your project, so nothing outside it can
import the artifact — which makes a scan of `include` a complete answer rather than a guess. When no file reaches for a
token from JavaScript, the exemption has no caller to serve and is skipped.

Measured on the sandboxes here:

| app          |    raw |   gzip | brotli |
| ------------ | -----: | -----: | -----: |
| svelte       | -20.2% | -12.9% | -12.2% |
| runtime-perf |  -2.1% |  -1.9% |  -2.3% |
| vite-ts      |     0% |     0% |     0% |

`vite-ts` is the control: it does not call `token()` either, and nothing changes because its CSS genuinely reads the
tokens it declares. Only declarations nothing can reach go.

A project that calls `token()`, `token.var()`, or imports the tokens artifact anywhere under `include` is unaffected —
and a hand-written `var(--x)` in source was already covered by the existing reference scan.
