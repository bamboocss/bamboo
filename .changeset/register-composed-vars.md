---
'@bamboocss/preset-base': major
---

Stop a composed custom property inheriting into a descendant that declares its own.

Registering the transform variables with `@property … { inherits: false }` fixed this for filters and transforms, but
ten of the variables the preset composes with were left unregistered, so they still inherited. Two of them rendered
wrong:

```tsx
<div className={css({ bgGradient: 'to-r', gradientFrom: 'red.500', gradientTo: 'blue.500' })}>
  <div className={css({ bgGradient: 'to-r' })} />
</div>
```

The child declares no colours, so it should render nothing. It rendered the parent's gradient, because
`--gradient-from`/`--gradient-to` reached it by inheritance. The same shape applied to `transition`: a descendant using
the shorthand inside an element that had set `transitionProperty` or `transitionDuration` silently took that element's
timing rather than its own defaults.

Now registered, and a child that declares its own composes only from what it declares:

- `--gradient-from`, `--gradient-to`, `--gradient-via`, `--gradient-via-stops`
- `--transition-prop`, `--transition-duration`, `--transition-easing`

Three more are registered for the same reason but change nothing observable, because every utility that reads them also
writes them in the same rule: `--gradient-stops`, `--gradient-position`, `--focus-ring-color`.

None takes an `initialValue`. The gradient colours are read bare rather than with a fallback, on purpose — an unset one
has to stay guaranteed-invalid so an incomplete gradient drops instead of rendering half of one, which is exactly what
registration without an initial value gives.

**Deliberately still inheriting:** `--focus-ring-color-prop`, `--focus-ring-width`, `--focus-ring-style` and
`--focus-ring-offset`. The utilities that set those emit only a variable and no declaration of their own, so theming a
subtree's focus rings from an ancestor is the only effect they have; registering them would turn that into dead CSS.
`--thickness`, `--bleed-x` and `--bleed-y` belong to patterns rather than utilities, and each is written by the same
transform that reads it, so neither can leak.

Costs 10 `@property` rules — about 40 bytes gzipped, emitted once.

Major because a nested element that set `bgGradient` or `transition` and relied on an ancestor's colours or timings will
now fall back to its own defaults. That was never something to rely on, but it is a visible change.
