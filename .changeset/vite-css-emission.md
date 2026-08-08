---
'@bamboocss/vite': minor
'@bamboocss/node': minor
---

`@bamboocss/vite` now emits the stylesheet itself, so a Vite project needs no PostCSS setup.

Import the virtual module wherever you used to import the file carrying the `@layer` statement:

```ts
// vite.config.ts
import bamboocss from '@bamboocss/vite'

export default defineConfig({
  plugins: [bamboocss(), react()],
})
```

```ts
// src/main.tsx
import 'virtual:bamboo.css'
```

```ts
// src/vite-env.d.ts
/// <reference types="@bamboocss/vite/client" />
```

`bamboocss()` now returns **two** plugins rather than one: the CSS emitter, which runs in dev and build alike, and the
build-only fold. If you were reaching into the returned object — `bamboocss().transform`, say — it is now an array.

**Why a virtual module rather than a written file**

Vite already owns both things a file would have to reimplement. In dev it injects CSS over the websocket and replaces it
in place, so a style edit repaints without reloading and without losing component state. In build it hashes the content
into the asset graph and decides where it lands. Writing `styles.css` and asking the project to import it means the
build reads a file the same process just wrote, which is a race on every watch rebuild.

The stylesheet carries its own `@layer reset, base, tokens, recipes, utilities;` statement, which the PostCSS path takes
from the file it injects into. That statement is what fixes layer _order_ — without it, layers are ordered by first
appearance.

**PostCSS still works.** This is an addition, not a replacement; nothing about the existing setup changes. Use one or
the other, though — configuring both puts two copies of the sheet in the bundle.

Also adds `Builder.toCss()` for anything that wants the finished stylesheet as a string rather than injected into a
PostCSS root.
