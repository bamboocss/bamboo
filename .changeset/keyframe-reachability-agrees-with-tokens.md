---
'@bamboocss/core': patch
'@bamboocss/generator': patch
'@bamboocss/node': patch
'@bamboocss/types': patch
---

Keep a `@keyframes` for as long as the token declaration naming it ships.

```css
--animations-drawer-in-right: slide-in-right 400ms ease-out; /* shipped */
/* @keyframes slide-in-right — deleted */
```

`pruneTokenVars` roots reachability at what the css references _plus_ what reaches a token from outside it: a `token()`
call, a `prune.keepTokens` pattern, a theme artifact injected at runtime, a `globalCss` export. `pruneKeyframes` asked
the same question of the same sheet a moment later and re-derived it from the css alone, which can see none of those. So
a token one pass kept had its keyframe deleted by the other, leaving a declaration pointing at a definition that is not
there. The stylesheet is valid, the build exits 0, and the animation simply never plays — the failure only a diff of the
output finds.

The token pass now hands its answer to the keyframe pass rather than each computing its own. A keyframe is dropped only
when the declarations naming it were dropped too, so the pass keeps its saving: on the default preset an app that uses
no animations still ships none of them, and its css is byte-identical to before.

**It was reported as depending on whether `include` covers `outdir`, which is a second route to it rather than the
cause.** `collectKeyframeReferences` scans source text for each declared name, and the generated token artifact contains
`slide-in-right 400ms` verbatim — so a project whose `include` reaches its own output was keeping its keyframes by
accident, and excluding `outdir` took the accident away. That overlap is no longer load-bearing for keyframes.

Under `prune: { tokens: 'off' }` every keyframe a declaration names is now kept. Nothing is removable there, and `off`
is the setting chosen precisely because something outside the stylesheet reads those declarations.
