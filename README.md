![Write typesafe styles with Bamboo](.github/assets/banner.png 'Write typesafe styles with Bamboo')

<p align="center">
  <br/>
  Bamboo is a universal styling solution for the modern web &mdash;
  <br/>
  build time, type-safe, and scalable CSS-in-JS
</p>

## Features

- ⚡️ Write style objects or style props, extract them at build time
- ✨ Modern CSS output — cascade layers `@layer`, css variables and more
- 🦄 Works with most JavaScript frameworks
- 🚀 Recipes and Variants - Just like Stitches™️ ✨
- 🎨 High-level design tokens support for simultaneous themes
- 💪 Type-safe styles and autocomplete (via codegen)

<br/>

---

<p align="center">
<b>
🐼 Get a taste of Bamboo. Try it out for yourself in&nbsp;
 <a href="https://stackblitz.com/edit/vitejs-vite-lfwyue?file=src%2FApp.tsx&terminal=dev">StackBlitz</a>
</b>
</p>

---

<br/>

## Documentation

Visit our [official documentation](https://bamboo-css.com/).

## Install

The **recommended** way to install the latest version of Bamboo is by running the command below:

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

Feel like contributing? That's awesome! We have a
[contributing guide](https://github.com/bamboo-css/bamboo/blob/main/CONTRIBUTING.md) to help guide you.

### Want to help improve the docs?

Our docsite lives in the [monorepo](./website/pages/docs/).

If you're interested in contributing to the documentation, check out the
[contributing guide](https://github.com/bamboo-css/bamboo/blob/main/CONTRIBUTING.md).

## Acknowledgement

The development of Bamboo started as a fork of [Panda CSS](https://panda-css.com/).