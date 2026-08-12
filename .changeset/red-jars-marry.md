---
'@bamboocss/vite': patch
---

Stop scanning every emitted asset for the stylesheet marker.

Both the prune pass and the lost-stylesheet guard added in 1.35.3 decoded **every** asset in the bundle to a UTF-8
string in order to search it — fonts, images, wasm and sourcemaps included — so the cost scaled with total asset bytes
rather than with CSS, and the guard paid it a second time. On a project with a large asset graph that is seconds of
decode and a lot of garbage per build.

The filename is now checked first. The marker is a CSS custom property, so it cannot occur in anything but CSS, and
nothing about which assets are inspected changes.
