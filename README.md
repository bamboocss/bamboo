<p align="center">
  Bamboo is build-time, type-safe CSS-in-JS &mdash;
  <br/>
  the scaffolding comes down before you ship.
</p>

## Why Bamboo?

Bamboo CSS is a fork of [Panda CSS](https://panda-css.com/) v1. The styling API is identical and
[migrating](https://bamboocss.com/docs/migration/panda) is mostly a rename; what changed is what reaches the browser and
what it costs.

- [Why we forked Panda CSS](https://bamboocss.com/docs/overview/why-bamboo#why-we-forked-panda-css)
- [How is Bamboo different from Panda CSS?](https://bamboocss.com/docs/overview/faq#how-is-bamboo-css-different-from-panda-css)

## Features

- ⚡️ Write style objects or style props, extract them at build time
- 🪶 [Optional zero runtime](https://bamboocss.com/docs/guides/source-transformation) – fold static `css()` calls and
  JSX into plain class strings at build time
- ✨ Modern CSS output – cascade layers `@layer`, css variables and more
- ✂️ Prune [unused tokens](https://bamboocss.com/docs/references/config#pruneunusedtokens) and
  [keyframes](https://bamboocss.com/docs/references/config#pruneunusedkeyframes) – ship only what your app uses
- 📦 [Grouped class output](https://bamboocss.com/docs/references/config#cssmode) – one class per `css()` call instead
  of one per property
- 🎯 [Predictable overrides](https://bamboocss.com/docs/concepts/writing-styles#classname-concatenation) – `cx` resolves
  conflicting utilities, so the last one passed wins instead of whichever the stylesheet ordered last
- 🛟 [Fallback values](https://bamboocss.com/docs/concepts/writing-styles#fallback-values) – `fallback(100dvh, 100vh)`
  for progressive enhancement, in one declaration
- 🦄 Works with most JavaScript frameworks
- 🚀 Recipes and Variants – composable style variants, an API [inspired by Stitches](https://stitches.dev/)
- 🎨 High-level design tokens support for simultaneous themes
- 💪 Type-safe styles and autocomplete (via codegen)
- 🤖 [MCP server](https://bamboocss.com/docs/ai/mcp-server) – let AI assistants read your tokens, recipes and usage

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
import { stack, vstack, hstack } from '../styled-system/patterns'

function Example() {
  return (
    <div>
      <div className={hstack({ gap: '30px', color: 'pink.300' })}>Box 1</div>
      <div className={css({ fontSize: 'lg', color: 'red.400' })}>Box 2</div>
    </div>
  )
}
```

## Directory Structure

| Package                                       | Description                                                  |
| --------------------------------------------- | ------------------------------------------------------------ |
| [cli](packages/cli)                           | CLI package installed by the end user                        |
| [core](packages/core)                         | Contains core features of Bamboo (utility, recipes, etc)     |
| [config](packages/config)                     | Contains functions for reading and merging the bamboo config |
| [extractor](packages/extractor)               | Contains code for fast AST parsing and scanning              |
| [generator](packages/generator)               | Contains codegen artifacts (js, css, jsx)                    |
| [parser](packages/parser)                     | Contains code for parsing a source code                      |
| [is-valid-prop](packages/is-valid-prop)       | Contains code for checking if a prop is a valid css prop     |
| [node](packages/node)                         | Contains the Node.js API of Bamboo's features                |
| [token-dictionary](packages/token-dictionary) | Contains code used to process tokens and semantic tokens     |
| [shared](packages/shared)                     | Contains shared TS functions                                 |

## Contributing

See the [contributing guide](https://github.com/bamboocss/bamboo/blob/main/CONTRIBUTING.md). The docs site lives in
[`website/content/docs`](./website/content/docs/).

## Acknowledgement

Bamboo CSS started as a fork of [Panda CSS](https://panda-css.com/).
