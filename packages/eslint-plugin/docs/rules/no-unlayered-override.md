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

## How to fix it

**Give the two styles different origins.** A recipe's classes are named from its config — `button--size_sm` — and
emitted into the `recipes` layer, so a consumer's `css()` in `utilities` wins by layer, in every build:

```jsx
const button = cva({ base: { padding: '4' } })

const Button = (props) => <button className={cx(button(), props.className)} />
```

Declaring it in `theme.recipes` behaves identically — the only difference is where the name comes from, and that a
declared recipe gets a generated module to import:

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
