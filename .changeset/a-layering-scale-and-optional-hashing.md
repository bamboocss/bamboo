---
'@bamboocss/preset-bamboo': minor
'@bamboocss/core': minor
'@bamboocss/types': minor
'@bamboocss/node': minor
'@bamboocss/vite': minor
---

A `zIndex` scale in the preset, and `hash: 'auto'`.

**`zIndex` tokens.** There was no such category, so every project invented one — usually as raw numbers scattered across
components, occasionally as semantic names copied from another design system. The second is the one that bites:
`zIndex: 'overlay'` against a theme declaring nothing resolves to nothing and ships `z-index: overlay`, which parses, so
no build objects, and which the browser discards — leaving the element with no stacking context at all. This repo's own
documentation site shipped that, in a drawer copied from Chakra.

`hide` `base` `docked` `dropdown` `sticky` `banner` `overlay` `modal` `popover` `skipNav` `toast` `tooltip`, spaced so a
project can slot its own layer between two without renumbering. Additive: twelve custom properties, no existing rule
changed.

**`hash: 'auto'`** hashes class names in production and leaves them readable in development. The mode comes from the
integration — the Vite plugin's dev server is development, everything else is production — and is resolved once at
context creation, so the emitted CSS and the compiled class literals cannot disagree about a name.

Measured on a five-page react-router app, `hash: { className: 'auto' }` against the default:

|                    | readable  | hashed            |
| ------------------ | --------- | ----------------- |
| stylesheet, raw    | 37,527 B  | 32,429 B (−14%)   |
| stylesheet, gzip   | 7,610 B   | 7,894 B (**+4%**) |
| longest class name | 105 chars | 6 chars           |

**The gzip column is why this is not the default.** Readable names repeat, so they compress almost to nothing; hashes
are incompressible. The raw sheet shrinks and the compressed sheet grows. Where hashing does pay is the _markup_ — a
105-character class serialising a whole `linear-gradient()` appears in every document that uses it, and each document is
compressed on its own — which is where the 20%-of-class-attribute-bytes figure that prompted this came from. Whether
that trade is worth it depends on how many documents a project ships and how many arbitrary values it writes, so it is a
decision to make with your own numbers rather than one to inherit.
