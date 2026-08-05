---
'@bamboocss/vite': minor
---

Fold a `styled.*` element that carries a runtime `className`.

`<styled.div color="red.300" className={cn} />` kept its factory because a dynamic class could not be concatenated into
a literal. The split already emits a `cx` call, so it becomes `<div className={cx("c_red.300", cn)} />` — with `cn`
last, which is where the factory's own `cx(styles, props.className)` put it, so a class it carries still wins the way it
did before.

This is the most common reason a reusable component declined, since forwarding `className` is how one is usually made
composable. Rendering fifty trees of such elements: 4.45x.

It has to be emitted last for the cascade and first for evaluation order, so a `className` declines when something
written after it survives the fold and could observe the swap. The test is two-sided, because `A;B` becoming `B;A` shows
as soon as `A` writes what `B` reads: a constant commutes with anything, while an expression that only reads commutes
only while the `className` cannot write. So `className={cn} onClick={h}` folds, `className={cn} id="x"` folds, and
`className={assigns()} bg={tone}` does not. A static style prop is exempt either way, being resolved rather than
emitted. A `className` written twice declines unless both are static, where the later simply overwrites as it does at
runtime.

An element with no style props at all now folds to `cx(cn)` rather than keeping a factory that had nothing to do.

Build time is unchanged on modules where nothing folds. Two per-file scans the helper resolution runs — the module
specifiers and the module-scope names — are now memoized against the file's text rather than repeated per element, which
removes a superlinear term predating this change: folding 600 elements went from 317ms to 39ms. A residual term remains,
since the declarations themselves are still walked per element.
