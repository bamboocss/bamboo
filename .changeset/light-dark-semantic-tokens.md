---
'@bamboocss/generator': minor
'@bamboocss/core': minor
---

Emit semantic tokens with an `_osDark` value as `light-dark()`, and raise the browser baseline to match.

A token whose only conditional value is `_osDark` cost two declarations and a media block. It now costs one line:

```diff
  :where(:root, :host) {
+   color-scheme: light dark;
-   --colors-text: var(--colors-gray-600);
+   --colors-text: light-dark(var(--colors-gray-600), var(--colors-gray-400));
  }
-
- @media (prefers-color-scheme: dark) {
-   :where(:root, :host) {
-     --colors-text: var(--colors-gray-400)
-   }
- }
```

The saving is one media block per stylesheet plus one declaration per token, so it scales with how many `_osDark`
semantic tokens a design system carries. Class names and hashes are unchanged.

**An explicit toggle stops meaning "restate every token"**

This is the more useful half. `_osDark` is a media query and `[data-theme=dark]` is a selector, so the two are separate
mechanisms that resolve against each other by source order — supporting both meant emitting every token twice.
`light-dark()` reads `color-scheme`, which is an ordinary inherited property, so a toggle is one declaration on a
subtree:

```css
[data-theme='dark'] {
  color-scheme: dark;
}
```

**`color-scheme: light dark` ships with the tokens**

`light-dark()` returns its light value whenever `color-scheme` does not name both, so a sheet that folds without
declaring it is a sheet where dark mode silently never engages. It is emitted in the tokens layer rather than the reset
for that reason — the reset can be turned off with `preflight: false`, and this is a prerequisite of the declarations
above it, not a nicety. It sits at zero specificity and only appears when something actually folded.

**Three shapes are left alone**

- A token carrying `_osLight` as well keeps both media blocks. Folding it would put the light arm and an
  `@media (prefers-color-scheme: light)` block in play for one variable, where the block wins on order and the arm is
  dead.
- `_dark` is a class selector, not a media query, so it stays a rule of its own.
- A redefined `osDark` condition — pointed at `[data-os=dark] &`, say — does not fold at all. It is a configurable
  condition rather than a keyword, and `light-dark()` cannot express a selector, so folding on the name alone would
  silently rewrite the mechanism the user picked.

**The baseline moves**

```diff
- Chrome >= 118      + Chrome >= 123
- Edge >= 118        + Edge >= 123
- iOS >= 17.4        + iOS >= 17.5
- Safari >= 17.4     + Safari >= 17.5
- Android >= 118     + Android >= 123
- Opera >= 106       + Opera >= 109
  Firefox >= 146
```

`light-dark()` is Baseline 2024 and lands later than `@scope` everywhere except Firefox, which got it at 120 against
`@scope` at 146 — so the two features now set the baseline between them. This is not optional the way a minifier setting
is: an unsupported browser does not fall back to the light value, it fails substitution and the declaration using the
token becomes invalid at computed-value time.
