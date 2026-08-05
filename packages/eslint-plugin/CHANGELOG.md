# @bamboocss/eslint-plugin

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/generator@1.15.0
  - @bamboocss/shared@1.15.0
  - @bamboocss/config@1.15.0

## 1.14.0

### Patch Changes

- d0b7016: `no-escape-hatch` now looks inside `fallback(...)` candidates.

  The rule tests whether the value as a whole is an escape hatch, and a fallback wraps its candidates — so
  `fallback([stretch], 100%)` slipped past it even though `[stretch]` is exactly what the rule exists to catch. Each
  candidate is now checked on its own.

  No autofix is offered in that case: the existing suggestion rewrites the whole value to its unwrapped form, which for
  a fallback would be a no-op. The report still points at the value.

- Updated dependencies [7cc6235]
- Updated dependencies [b567114]
- Updated dependencies [3264da1]
- Updated dependencies [d1d05fc]
  - @bamboocss/generator@1.14.0
  - @bamboocss/shared@1.14.0
  - @bamboocss/config@1.14.0

## 1.13.2

### Patch Changes

- Updated dependencies [79c9872]
- Updated dependencies [61fe88c]
- Updated dependencies [ba60cf5]
- Updated dependencies [be3764d]
- Updated dependencies [7a63215]
- Updated dependencies [2130606]
  - @bamboocss/shared@1.13.2
  - @bamboocss/generator@1.13.2
  - @bamboocss/config@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/config@1.13.1
- @bamboocss/generator@1.13.1
- @bamboocss/shared@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [9ffb84f]
- Updated dependencies [e482ab3]
- Updated dependencies [7bf6798]
- Updated dependencies [8a6c23e]
- Updated dependencies [17de3d0]
- Updated dependencies [cd76ba7]
- Updated dependencies [11c9409]
- Updated dependencies [9ffb84f]
- Updated dependencies [fd03a10]
- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [9ffb84f]
- Updated dependencies [a966bae]
- Updated dependencies [5b16a67]
  - @bamboocss/generator@1.13.0
  - @bamboocss/shared@1.13.0
  - @bamboocss/config@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/generator@1.12.3
- @bamboocss/config@1.12.3
- @bamboocss/shared@1.12.3

## 1.12.2

### Patch Changes

- Fix rule prefix in exported configs from `@bamboocss/` to `bamboo/` to match the plugin name used by consumers in
  ESLint flat config and oxlint jsPlugins.
  - @bamboocss/config@1.12.2
  - @bamboocss/generator@1.12.2
  - @bamboocss/shared@1.12.2

## 1.12.1

### Patch Changes

- Fix runtime error caused by test fixtures being bundled into the production dist, which created a dependency on
  @bamboocss/types at runtime.
  - @bamboocss/config@1.12.1
  - @bamboocss/generator@1.12.1
  - @bamboocss/shared@1.12.1

## 1.12.0

### Minor Changes

- Add ESLint plugin for Bamboo CSS with 19 rules covering design token enforcement, property validation, and best
  practices.

### Patch Changes

- @bamboocss/config@1.12.0
- @bamboocss/generator@1.12.0
- @bamboocss/shared@1.12.0
