<p align="center">
  Bamboo is build-time, type-safe, zero-runtime CSS-in-JS
</p>

## Why Bamboo?

Bamboo [folds](https://bamboocss.com/docs/guides/source-transformation) each call into the string it would have
returned:

```tsx
// you write
<div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Title</div>
<div className={css({ fontSize: 'lg', fontWeight: active ? 'bold' : 'normal' })}>Title</div>

// the bundle gets
<div className="fs_lg fw_bold">Title</div>
<div className={cx('fs_lg', active ? 'fw_bold' : 'fw_normal')}>Title</div>
```

Once every call folds, nothing imports `styled-system/css` and the engine drops out of the bundle.
[`failOnUnfolded`](https://bamboocss.com/docs/guides/source-transformation#failonunfolded) fails the build if one call
survives, so zero runtime is something you can hold rather than hope for.

Bamboo [fails](https://bamboocss.com/docs/concepts/build-diagnostics) the build when a call names a pattern or token
that does not exist:

```
ERR_BAMBOO_DEAD_IMPORT: 12 call(s) name a binding that does not exist:

`stack` is not a pattern — `../styled-system/patterns` does not export it.
  12 file(s): src/modal.tsx, src/drawer.tsx, src/sheet.tsx, … and 9 more
```

Bamboo [prunes](https://bamboocss.com/docs/references/config#prune) tokens, keyframes and reset rules that your
application does not use. On the example apps here that is 36–78% of `styles.css` — one goes from 18,032 bytes to 3,959.

Bamboo is used in production by [Contra](https://contra.com), whose UI has more than 20,000 `css()` call sites, and is
covered by more than 3,000 tests.

## Features

- 🎯 [Predictable overrides](https://bamboocss.com/docs/concepts/cascade-layers) – precedence comes from cascade layers
  rather than source order, so a consumer's `css()` wins over a component's `cva`/`sva` recipe
- 🤖 [MCP server](https://bamboocss.com/docs/ai/mcp-server) – AI assistants read your tokens, recipes and usage

Plus design tokens with simultaneous themes, type-safe styles and autocomplete via codegen, recipes and variants
[inspired by Stitches](https://stitches.dev/),
[fallback values](https://bamboocss.com/docs/concepts/writing-styles#fallback-values),
[view transitions](https://bamboocss.com/docs/concepts/view-transitions), and support for most JavaScript frameworks.

---

## Install

Install the CLI and the Vite plugin, then scaffold the config:

```bash
npm i -D @bamboocss/dev @bamboocss/vite
npx bamboo init
```

Add the plugin. It emits the stylesheet and folds your calls into class strings — without it you get neither:

```ts
// vite.config.ts
import bamboocss from '@bamboocss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [bamboocss()],
})
```

Import the virtual stylesheet. There is no `@layer` file to write — the virtual module emits its own:

```ts
// src/main.tsx
import 'virtual:bamboo.css'
```

Start using bamboo:

```jsx
import { css } from '../styled-system/css'
import { flex } from '../styled-system/patterns'

<div className={flex({ align: 'center', gap: '30px', color: 'pink.300' })}>Box 1</div>
<div className={css({ fontSize: 'lg', color: 'red.400' })}>Box 2</div>
```

Not on Vite? [PostCSS](https://bamboocss.com/docs/installation/postcss) works too, but only the Vite plugin folds calls
into class strings.

## Directory Structure

Installed by you:

| Package                                             | Description                                                   |
| --------------------------------------------------- | ------------------------------------------------------------- |
| [cli](packages/cli)                                 | The `@bamboocss/dev` package and the `bamboo` command         |
| [vite](packages/vite)                               | Vite plugin: emits the stylesheet and folds static calls      |
| [postcss](packages/postcss)                         | PostCSS plugin                                                |
| [eslint-plugin](packages/eslint-plugin)             | Lint rules for token paths, escape hatches and recipe usage   |
| [mcp](packages/mcp)                                 | MCP server exposing tokens, recipes and usage to assistants   |
| [plugin-lightningcss](packages/plugin-lightningcss) | Opt-in LightningCSS optimizer, replacing the PostCSS pipeline |
| [preset-base](packages/preset-base)                 | The default utilities, patterns and conditions                |
| [preset-bamboo](packages/preset-bamboo)             | The default design tokens, keyframes and mixins               |
| [preset-atlaskit](packages/preset-atlaskit)         | Atlassian Design System tokens                                |
| [preset-open-props](packages/preset-open-props)     | Open Props tokens                                             |

Everything else under [`packages/`](packages/) is pulled in for you — the config loader, parser, extractor, generator
and the rest of the pipeline.

## Contributing

See the [contributing guide](https://github.com/gajus/bamboocss/blob/main/CONTRIBUTING.md). The docs site lives in
[`website/content/docs`](./website/content/docs/).

## Acknowledgement

Bamboo CSS started as a fork of [Panda CSS](https://panda-css.com/).
