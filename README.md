<p align="center">
  Bamboo is build-time, type-safe CSS-in-JS &mdash;
  <br/>
  the scaffolding comes down before you ship.
</p>

## Why we forked Panda CSS

Bamboo is the styling engine behind [Contra](https://contra.com), whose UI has more than 20,000 `css()` call sites. At
that scale everything a styling library spends per call site — bytes emitted, work at runtime, time in the build — is
multiplied by five figures, so optimizations too small to notice elsewhere are plainly measurable.

The fork exists to chase them further than a general-purpose library reasonably would. That is the priority for every
release.

## How is this different from Panda CSS?

Bamboo CSS is a fork of [Panda CSS](https://panda-css.com/) v1, so the styling API is identical and
[migrating](https://bamboocss.com/docs/migration/panda) is mostly a rename. What has changed since the fork is what
reaches the browser and what it costs:

- **Less CSS** — `pruneUnusedTokens` drops token variables nothing can reach, taking `styles.css` from 24.4 KB to 12.3
  KB on our own sandbox.
- **Less JavaScript** — the generated output declares `sideEffects` and stops emitting the JSX property list twice, so a
  barrel import falls from 41.2 KB to 30.1 KB minified.
- **A faster runtime** — repeated `css()` calls are roughly 4-5x faster, and the class-name cache is bounded rather than
  growing for the life of the process, which used to leak under long-lived SSR.
- **Optional zero runtime** — [`@bamboocss/vite`](https://bamboocss.com/docs/guides/source-transformation) folds
  statically-resolvable `css()` calls into plain class strings at build time.
- **Less HTML** — [`cssMode: 'grouped'`](https://bamboocss.com/docs/references/config#cssmode) emits one class per
  `css()` call instead of one per property, trading CSS duplication for shorter class attributes and faster style
  recalculation.

Every figure is measured against this repository's own sandboxes; the output-size wins scale with the size of your
design system rather than your app. The
[full comparison](https://bamboocss.com/docs/overview/faq#how-is-bamboo-css-different-from-panda-css) has the rest.

## Features

- ⚡️ Write style objects or style props, extract them at build time
- ✨ Modern CSS output — cascade layers `@layer`, css variables and more
- 🦄 Works with most JavaScript frameworks
- 🚀 Recipes and Variants - Just like Stitches™️ ✨
- 🎨 High-level design tokens support for simultaneous themes
- 💪 Type-safe styles and autocomplete (via codegen)

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
