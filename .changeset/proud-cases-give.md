---
'@bamboocss/vite': patch
---

Assert the size and the duplication of the emitted stylesheet.

Nothing measured CSS output. Every change to atomisation, pruning or naming moves it, and the only way anyone noticed
was by grepping a shipped bundle — which is how a bug that removed every `::before` rule reached production.

The fixture authors the same declarations five ways: a bare `css()` call, a recipe base, a recipe variant, a second
recipe, and a condition. Two assertions with different jobs:

- **Duplication counts**, which are the stable half. Global atom sharing means a declaration authored five ways reaches
  the stylesheet once, and that holds regardless of formatting, minifier or token values. It fails the moment sharing
  breaks.
- **A byte ceiling**, deliberately loose at roughly double what the fixture emits. Its job is to catch a step change —
  sharing breaking, a layer emitted twice, pruning stopping — not to police ordinary drift. It prints the real figure,
  so raising it is a one-line decision rather than an investigation.

Asserted rather than benchmarked because bytes are deterministic, so this runs in CI where a wall-clock measurement
would only be flaky.
