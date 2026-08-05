---
'@bamboocss/core': patch
---

Make `StaticCss.clone()` return an independent instance.

It reassigned its own encoder and decoder and handed back `this`, so every caller shared one object — and, less visibly,
one `wildcardCache`. Callers reach for it to get isolation: `ctx.staticCss.clone().process(…)` is the idiom throughout
the tests and benchmarks.

The cache is what made this worth fixing. A "cold" instance inherited whatever the last caller had warmed, so the cold
and warm `process()` benchmarks measured the same populated cache and sat within 2% of each other — a pair whose whole
purpose was to show the difference between them. With the clone actually isolated they read 203ms against 135ms, so the
wildcard cache is worth about a third of `process()`; it was always doing that work, and nothing could show it.

The cloned encoder and decoder stay cloned rather than rebuilt from the context: `process()` reads whether they differ
from `context.encoder`/`context.decoder` to tell a clone from the context's own instance, and uses fresh ones per call
when they do.

No production code calls `clone()` — it is a test and benchmark affordance — so this changes no CSS output.
