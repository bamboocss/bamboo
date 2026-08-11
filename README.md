<p align="center">
  Bamboo is build-time, type-safe CSS-in-JS &mdash;
  <br/>
  the scaffolding comes down before you ship.
</p>

## Why Bamboo?

**Every class name comes from a call the compiler can see.** No JSX factory, no template literals, no style props — so a
production build can
[fold the call into the string it would have returned](https://bamboocss.com/docs/guides/source-transformation):

```tsx
// you write
<div className={css({ fontSize: 'lg', fontWeight: 'bold' })}>Title</div>

// the bundle gets
<div className="fs_lg fw_bold">Title</div>
```

A style that varies does not put the call back. Both branches are known, so each resolves at build time and only the
choice is left behind:

```tsx
// you write
css({ fontSize: 'lg', fontWeight: active ? 'bold' : 'normal' })

// the bundle gets
cx('fs_lg', active ? 'fw_bold' : 'fw_normal')
```

**A build that succeeds ships every rule your source asked for.** Static extraction fails quietly by nature: a file the
build could not read, a call to a pattern that no longer exists, a value naming a token with a typo in it. Each one
emits nothing, the class your component asks for has no rule behind it, and the stylesheet is still perfectly valid — so
the build exits 0. Bamboo stops instead:

```
ERR_BAMBOO_DEAD_IMPORT: 12 call(s) name a binding that does not exist:

`stack` is not a pattern — `../styled-system/patterns` does not export it.
  12 file(s): src/modal.tsx, src/drawer.tsx, src/sheet.tsx, … and 9 more
```

Removing one pattern took eleven selectors out of a release this way. Codegen printed four ticks and exited 0, and it
was found by diffing selector sets after the fact.
[Everything the build refuses to ship broken →](https://bamboocss.com/docs/concepts/build-diagnostics)

**You ship the CSS you use, not the CSS your design system defines.** The token layer declares every token in your
theme; an app uses a fraction of them. Dropping what nothing can reach is worth 36% to 78% of `styles.css` on the
example apps in this repository — one goes from 18,032 bytes to 3,959, and 4,828 gzipped to 1,525.

Bamboo is the styling engine behind [Contra](https://contra.com), whose UI has more than 20,000 `css()` call sites.

## Features

- 🪶 [Optional zero runtime](https://bamboocss.com/docs/guides/source-transformation) – static `css()`, pattern and
  recipe calls become plain class strings at build time
- 🛑 [Nothing ships silently broken](https://bamboocss.com/docs/concepts/build-diagnostics) – an unreadable file, a call
  to a pattern that no longer exists, or a value naming a token that does not, fails the build rather than emitting
  nothing
- ✂️ Prune [unused tokens](https://bamboocss.com/docs/references/config#prunetokens),
  [keyframes](https://bamboocss.com/docs/references/config#prunekeyframes) and
  [reset rules](https://bamboocss.com/docs/references/config#preflightprune) – 36–78% of `styles.css` on the apps here
- 🎯 [Predictable overrides](https://bamboocss.com/docs/concepts/cascade-layers) – precedence is decided by cascade
  layer, so a component written with `cva`/`sva` lands in `recipes` and a consumer's `css()` in `utilities` wins
- 🤖 [MCP server](https://bamboocss.com/docs/ai/mcp-server) – let AI assistants read your tokens, recipes and usage

Plus design tokens with simultaneous themes, type-safe styles and autocomplete via codegen, recipes and variants
[inspired by Stitches](https://stitches.dev/),
[fallback values](https://bamboocss.com/docs/concepts/writing-styles#fallback-values),
[view transitions](https://bamboocss.com/docs/concepts/view-transitions), and support for most JavaScript frameworks.

---

## Install

Install the CLI:

```bash
npm i -D @bamboocss/dev
```

To scaffold the bamboo config and postcss

```bash
npx bamboo init -p
```

Setup and import the entry CSS file

```css
@layer reset, base, tokens, recipes, utilities;
```

```jsx
import 'path/to/entry.css'
```

Start the dev server of your project

```bash
npm run dev
```

Start using bamboo

```jsx
import { css } from '../styled-system/css'
import { flex } from '../styled-system/patterns'

function Example() {
  return (
    <div>
      <div className={flex({ align: 'center', gap: '30px', color: 'pink.300' })}>Box 1</div>
      <div className={css({ fontSize: 'lg', color: 'red.400' })}>Box 2</div>
    </div>
  )
}
```

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

Pulled in for you:

| Package                                       | Description                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| [core](packages/core)                         | Contains core features of Bamboo (utility, recipes, etc)     |
| [config](packages/config)                     | Contains functions for reading and merging the bamboo config |
| [extractor](packages/extractor)               | Contains code for fast AST parsing and scanning              |
| [generator](packages/generator)               | Contains codegen artifacts (js, css)                         |
| [parser](packages/parser)                     | Contains code for parsing a source code                      |
| [is-valid-prop](packages/is-valid-prop)       | Contains code for checking if a prop is a valid css prop     |
| [node](packages/node)                         | Contains the Node.js API of Bamboo's features                |
| [token-dictionary](packages/token-dictionary) | Contains code used to process tokens and semantic tokens     |
| [shared](packages/shared)                     | Contains shared TS functions                                 |
| [types](packages/types)                       | Public type definitions, including the config shape          |
| [logger](packages/logger)                     | Log formatting and filtering                                 |
| [reporter](packages/reporter)                 | Builds the token and recipe usage reports behind `analyze`   |
| [plugin-vue](packages/plugin-vue)             | Vue SFC parsing, auto-injected                               |
| [plugin-svelte](packages/plugin-svelte)       | Svelte component parsing, auto-injected                      |

## Contributing

See the [contributing guide](https://github.com/gajus/bamboocss/blob/main/CONTRIBUTING.md). The docs site lives in
[`website/content/docs`](./website/content/docs/).

## Acknowledgement

Bamboo CSS started as a fork of [Panda CSS](https://panda-css.com/).
