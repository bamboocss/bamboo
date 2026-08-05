---
'@bamboocss/vite': minor
---

Fold a `styled.*` or pattern element that carries `ref`, `key` or an explicit `children` prop, under React.

All three were declined alongside `unstyled` and `css`, but unlike those two they change nothing about how the element
is styled — so the fold was refusing them for the company they kept.

`<styled.div ref={r} color="red.300" />` becomes `<div ref={r} className={"c_red.300"} />`. React's factory forwards the
ref to the element it renders, so moving it onto that element changes nothing — verified against a real DOM for object
refs, callback refs, React 19 cleanup functions, detach on unmount, and `as` naming a component that does and does not
forward.

React only, and measured rather than reasoned about. Preact was included at first because its factory wraps in
`forwardRef` too, and that inference was wrong: an unfolded `ref` there binds the component instance while a folded one
binds the DOM node. Vue diverges for the plain reason — a ref on a component is the instance, on an element it is the
node. Every other framework keeps the behaviour it had.

`key` never reaches the component, React consuming it for reconciliation. An explicit `children` prop declines when the
target is not an intrinsic tag: the factory's `children ?? combinedProps.children` collapses `null` to `undefined`, so a
destructuring default fires where the folded `children={null}` would not.

Each travels as a passthrough, so the ordering rules already in place apply — `className={writes()} ref={r}` declines,
because the ref read would move behind the write.

Two things this also closes on the pattern path. A `jsxElement` that is not an intrinsic tag now declines rather than
folding: the runtime hands it to `createElement` as a string, so `jsxElement: 'Section'` folded to `<Section />`, which
is a variable reference and threw at render. And `foo.bar` folded to a member expression naming something in scope.

`unstyled` and a `css` prop still decline. Those two do change the styling: one skips the recipe, the other merges above
the style props.

No build-time cost either way. The per-element check is the same set lookup; elements that previously bailed at it now
run the rest of the loop and fold, which is the point.
