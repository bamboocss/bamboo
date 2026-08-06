---
'@bamboocss/parser': patch
---

Stop `cssMode: 'grouped'` silently dropping style props from a `styled(Component, cvaConfig)` element.

`<Button size="sm" fontSize="30px" />` rendered with no font size at all. The component's runtime merges the cva's
styles with the element's style props into a single `css()` call, but the build cannot see through the component to the
cva — it sees only the props. So the group it encoded was a strict _subset_ of the one the runtime asked for and could
never match it, and the fallback then named the props atomically with no atomic rule to land on.

Style props on an element whose component the build cannot see through are now encoded atomically as well as grouped.
The cva's own styles are already atomic, so both halves of the merged call now have rules behind them.

`styled.div` is unaffected: it carries no cva, its runtime groups exactly what the build encoded, and the atomic copies
would be dead weight.

This does not make `styled(Component, cvaConfig)` _group_ — the element still carries the cva's atomic classes rather
than one class. It makes it correct.
