---
'@bamboocss/dev': patch
---

Fix four dead declarations on the documentation site, and turn the check that found them on there.

`strictTokens: 'unknown-tokens'` is what `bamboo init` now writes, so the site it is documented on should be running it.
Doing that reported four, all real, all shipping a declaration the browser discards:

- `zIndex: 'overlay'` and two `zIndex: 'modal'` in the drawer recipe, which came from Chakra where those are tokens.
  Nothing declared them here, so the sheet carried `z-index: overlay` and `z-index: modal` — both parse, so no build
  objected, and both are discarded, leaving the drawer with no stacking context at all. They are declared now, in the
  dialog's neighbourhood rather than Chakra's 1300/1400: `dialog.tsx` sets `--dialog-z-index: 200` and stacks above it,
  and the drawer is the same kind of surface.
- `transform: 'auto'` on the expand icon, which is Panda's sugar for composing the transform variables. Bamboo has no
  such value, so it emitted a literal `transform: auto`, which is not css. Removed rather than translated: `rotate` here
  is bamboo's utility for the standalone `rotate` property, so the rotation was already applying on its own and the
  declaration was doing nothing.

`next build` type-checks, so the setting is enforced by the website workflow from now on rather than being advice.
