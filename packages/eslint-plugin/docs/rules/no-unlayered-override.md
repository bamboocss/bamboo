# Disallow joining a class this file styled with a class it cannot see, where neither can win by cascade layer (`@bamboocss/no-unlayered-override`)

⚠️ This rule _warns_ in the following configs: 🌐 `all`, ✅ `recommended`.

<!-- end auto-generated rule header -->

`cx` joins class names. It does not resolve conflicts between them, in any build — see
[Merging styles](https://bamboocss.com/docs/concepts/merging-styles).

So when a component styles itself with `css()` and joins a `className` it was handed, both classes are in the
`utilities` layer. Which one applies is decided by their order in the stylesheet, not by the order they were passed, and
the caller has no way to influence it.

```jsx
// ⚠️ the caller's padding may or may not win
const Card = (props) => <div className={cx(css({ padding: '4' }), props.className)} />
```

An inline `cva()` is the same case. Its output is atomic, exactly like `css()`, so it lands in `utilities` too.

```jsx
// ⚠️ same problem — an inline cva is not in the `recipes` layer
const button = cva({ base: { padding: '4' } })
const Button = (props) => <button className={cx(button(), props.className)} />
```

## How to fix it

**Give the two styles different origins.** A config recipe — declared in `theme.recipes` or `theme.slotRecipes` — lands
in the `recipes` layer, and a consumer's `css()` in `utilities` then wins by layer, in every build:

```jsx
import { button } from '../styled-system/recipes'

const Button = (props) => <button className={cx(button(), props.className)} />
```

**Or accept a style object rather than a class name.** `css()` merges per property before any class name exists, so it
resolves the same way in every build and needs no layer at all:

```jsx
const Card = ({ css: cssProp, ...rest }) => <div className={css({ padding: '4' }, cssProp)} {...rest} />
```

## When not to use it

The rule only fires when one argument is styles this file owns and another is a value it cannot see. Joining two visible
`css()` calls is not reported — you own both, and `css(a, b)` is available if you want them merged. Neither is joining a
static marker class such as `'group'`, which carries no styles to conflict with.
