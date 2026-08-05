---
'@bamboocss/vite': minor
---

Lower a runtime-valued style prop on a `styled.*` element, instead of sending it to a `css()` call.

`<styled.div color="red.300" backgroundColor={tone} />` folded to `cx("c_red.300", css({ backgroundColor: tone }))`. It
now folds to `cx("c_red.300", cssLeaf("bg-c_", "backgroundColor", tone))`, the same lowering the call-site split already
did.

An element whose props are _all_ runtime-valued now folds too, where it previously kept its factory for want of a static
half to hoist. That is the case where the factory was pure overhead, since no static class amortised it.

Rendering fifty trees of runtime-valued props goes from 1.58x to 2.86x against the unfolded source, and the fixture's
`styled.*` elements drop from 6 to 1 with its `css()` calls from 1 to 0. A mixed tree is unchanged at 3.2x, since little
of it reaches this path.

Two rules narrow it, both about a `css()` object being last-wins where separate classes are not. Two props claiming one
property — `mx` and `marginInline` — are never lowered apart. And lowered props may sit before or after what stays
behind, but not interleave with it, since splitting the residue into two calls would turn one merge into two.
