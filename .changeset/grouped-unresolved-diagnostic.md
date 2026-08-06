---
'@bamboocss/parser': patch
'@bamboocss/node': patch
---

Warn, with a file and line, when a `css()` call under `cssMode: 'grouped'` contains a value the build cannot resolve.

Under `grouped` one class names the whole call, so a property the build cannot see does not merely go missing — it
changes the class, and the element renders with **no** styles at all. Until now that happened silently: the build
emitted a rule, the runtime returned a different class, and nothing said so.

Two shapes are detected, because one of them leaves no trace in the extracted styles:

- a value boxed as unresolvable, or a template literal with an interpolation
- a property whose value could not be evaluated at all — `css({ color: getColor() })`. The extractor records no pair for
  it, so the key vanishes from the box entirely; it is recovered by reading the call's object literal back and
  comparing.

Shapes that cannot be read confidently — a spread, a computed key, a multi-argument call — are declined rather than
guessed at, so the warning does not fire on styles that are fine.

A warning, not an error: the build is not wrong and the same call is perfectly valid under `cssMode: 'atomic'`, which
loses one declaration and keeps the rest. Nothing is reported under `atomic` for that reason.
