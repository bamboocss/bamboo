---
'@bamboocss/types': patch
---

Document what `minify` is worth and when it applies.

The option has always been there and has always worked; nothing said what it buys or who needs it. Measured on the
example apps in this repository:

| app     |    raw |  gzip | brotli |
| ------- | -----: | ----: | -----: |
| vite-ts | -21.6% | -5.6% |  -4.8% |
| svelte  | -20.4% | -6.6% |  -7.3% |

The gzip column is a quarter of the raw one, because compression collapses indentation long before you get to it — which
is also why it stays off by default rather than becoming one: for the many projects that import the stylesheet through a
bundler, production CSS minification has already happened. It matters when `styled-system/styles.css` ships as-is, from
an HTML file, a CDN, or inside a published component library, and that case gets the indented output today.

No behaviour change.
