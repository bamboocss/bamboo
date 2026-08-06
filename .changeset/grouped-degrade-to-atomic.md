---
'@bamboocss/parser': patch
'@bamboocss/core': patch
'@bamboocss/node': patch
---

Stop `cssMode: 'grouped'` rendering elements with no styles at all, in the shapes that were left.

A grouped class names a whole `css()` call, so the build has to have encoded that exact call to emit its rule. The
runtime already falls back to atomic class names when it has not — but a fallback only helps if atomic rules for those
names exist, and the build emitted them for a `css()` call it knew it had lost and nowhere else. Every other way of
losing a call landed on nothing, and the element rendered unstyled with no warning:

- A conditional value beside any other prop on a JSX element or in a pattern —
  `<styled.div color={on ? 'red' : 'blue'} padding="2" />`. Only `css()` reconstructs a ternary's branches; a JSX
  element or a pattern encoded each extracted object on its own, and the runtime asked for the merge of them.
- A value the build could not evaluate beside another prop on either — `<styled.div color={props.tone} padding="2" />`.
- A property lost to a spread — `css({ ...props.styles, color: 'red' })`.
- Two arguments setting one property, which the build read as a pair of ternary branches rather than as a merge —
  `css({ color: { base: 'red' } }, { color: { _hover: 'blue' } })`.

Those now emit their atomic rules alongside their group, so the element keeps every declaration the build resolved — the
same styling `cssMode: 'atomic'` gives for the same source. The `css()` cases warn, with a file, a line, and what to
change; a conditional style prop is ordinary code and does not.

Two shapes group properly now instead of degrading:

- A ternary inside a condition block, beside another property —
  `css({ _hover: { color: on ? 'red' : 'blue' }, padding: '2' })`. Reconstructing the branches combined them with
  `Object.assign`, so the empty `_hover` carried by the entry holding `padding` replaced the branch's condition instead
  of merging into it. They are merged the way `mergeCss` merges now.
- An array argument — `css([{ color: 'red' }, { padding: '2' }])`.

A call site that emits atomic rules alongside its group costs some CSS. It is bounded by how many call sites the build
cannot fully see, and buys back the styles they were dropping.
