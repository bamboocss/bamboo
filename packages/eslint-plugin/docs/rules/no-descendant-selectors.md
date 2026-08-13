# Disallow nested selectors that style a different element than the class is applied to (`@bamboocss/no-descendant-selectors`)

⚠️ This rule _warns_ in the 🌐 `all` config.

<!-- end auto-generated rule header -->

Cascade layers decide between rules in **different** layers. Two `css()` calls are always in the same one, so between
them nothing has changed about CSS: specificity decides, and a nested selector is more specific than a class.

```jsx
const prose = css({ '& p': { fontSize: '14.5px' } }) // (0,1,1)
const lede = css({ fontSize: '16px' }) //               (0,1,0)

// renders at 14.5px — the class is on the element and loses anyway
;<article className={prose}>
  <p className={lede}>…</p>
</article>
```

Nothing reports this. The CSS is correct, the class is on the element, and the applied value is simply not the one that
was asked for — which is why it tends to be found by looking at the page rather than at the code.

A nested selector also reaches further than it appears to. `'& a'` on an article underlines every anchor inside it,
including the ones in a navigation card that styles itself.

## How to fix it

**Style the element itself.** Colocating styles on the element they apply to is the recommendation for
[nested styles](https://bamboocss.com/docs/concepts/writing-styles#native-css-nesting) generally, and this is what it is
for.

**Scoping is worth doing, and does not satisfy this rule.** `& > p` and `& :is(p, li) a` bound what a selector can
reach, which is how you stop a prose block from underlining the anchors in a card nested inside it. But `& > p` is
`(0,1,1)` as well, so it still outranks a class on the paragraph it matches — the collision is narrowed, not removed,
and the rule reports it either way.

## When not to use it

Content you do not write the markup for — rendered markdown, a CMS body, `dangerouslySetInnerHTML` — cannot carry
classes, and a descendant selector is the only way to style it. The same goes for a headless component that exposes its
internals as `[data-part]` attributes rather than as elements you render. Turn the rule off for those files, or keep it
on and disable it per selector, which leaves a record of where the boundary is.

A selector whose subject is `&` is never reported: `'.dark &'` and `'.group:hover &'` contain a combinator and still
style the element itself. Conditions compile to exactly that shape.
