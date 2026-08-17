# Report an edge or pair value written longer than it needs to be, where a shorter spelling sets exactly the same properties (`@bamboocss/no-redundant-value`)

⚠️ This rule _warns_ in the 🌐 `all` config.

💡 This rule is manually fixable by
[editor suggestions](https://eslint.org/docs/latest/use/core-concepts#rule-suggestions).

<!-- end auto-generated rule header -->

## Why

Bamboo names an atomic class from the value you wrote, so two spellings of the same value are two classes and two rules
— even though the browser computes the same thing from both. A production build measured for this carried one padding as
`16px`, `16px 16px` and `16px 16px 0 16px`, and one shadow written four ways, each with its own rule in the stylesheet.

Nothing renders wrongly; the sheet is just carrying the drift of a large codebase. This reports the longer spellings so
they converge on one.

```ts
// each of these is a separate class and a separate rule
css({ padding: '16px 16px' })
css({ padding: '16px' })

// as is each of these
css({ margin: '0px 16px 0px 16px' })
css({ margin: '0 16px' })
```

## What it checks

Two families, both where CSS defines the omitted values as copies of the ones given:

- **Edge properties** — `padding`, `margin`, `inset`, `borderWidth`, `borderColor`, `borderStyle`, `scrollMargin`,
  `scrollPadding`, and Bamboo's `p` and `m`. Four equal edges collapse to one value, a matching pair to two, a matching
  left and right to three.
- **Pair properties** — `gap`, `gridGap`, `overflow`, `overscrollBehavior`. A repeated pair collapses to a single value.

A zero length is normalised first, since `0px` and `0` are the same zero and are otherwise two atoms.

This is an allowlist rather than a test on the shape of the value, because the shape is not enough to know the collapse
is sound. `backgroundPosition: '0 0'` is left-top while `backgroundPosition: '0'` is left-centre — same shape, different
meaning — so it is left alone.

Values are split with parentheses respected, so `calc(1rem + 2px) calc(1rem + 2px)` is seen as two identical edges
rather than four fragments. A value whose parentheses do not balance is left alone.

## What it does not check

The larger source of duplicate atoms in the build this was written from is a design token spelled against its own
literal — `p: '4'` and `p: '4px'`, where the spacing token resolves to the length. That wants a rule of its own
alongside [`no-hardcoded-color`](./no-hardcoded-color.md), since the advice is "use the token", not "this is redundant".

## Options

<!-- begin auto-generated rule options list -->

| Name        | Type     |
| :---------- | :------- |
| `whitelist` | String[] |

<!-- end auto-generated rule options list -->
