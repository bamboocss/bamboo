# @bamboocss/mcp

## 1.35.4

### Patch Changes

- @bamboocss/logger@1.35.4
- @bamboocss/node@1.35.4
- @bamboocss/token-dictionary@1.35.4
- @bamboocss/types@1.35.4

## 1.35.3

### Patch Changes

- @bamboocss/logger@1.35.3
- @bamboocss/node@1.35.3
- @bamboocss/token-dictionary@1.35.3
- @bamboocss/types@1.35.3

## 1.35.2

### Patch Changes

- @bamboocss/node@1.35.2
- @bamboocss/token-dictionary@1.35.2
- @bamboocss/types@1.35.2
- @bamboocss/logger@1.35.2

## 1.35.1

### Patch Changes

- @bamboocss/logger@1.35.1
- @bamboocss/node@1.35.1
- @bamboocss/token-dictionary@1.35.1
- @bamboocss/types@1.35.1

## 1.35.0

### Patch Changes

- Updated dependencies [9bfcf31]
  - @bamboocss/node@1.35.0
  - @bamboocss/types@1.35.0
  - @bamboocss/logger@1.35.0
  - @bamboocss/token-dictionary@1.35.0

## 1.34.1

### Patch Changes

- @bamboocss/node@1.34.1
- @bamboocss/logger@1.34.1
- @bamboocss/token-dictionary@1.34.1
- @bamboocss/types@1.34.1

## 1.34.0

### Patch Changes

- Updated dependencies [c49ab36]
- Updated dependencies [e66c5f8]
- Updated dependencies [c527ea7]
- Updated dependencies [10bf63d]
- Updated dependencies [c49ab36]
- Updated dependencies [09d4203]
- Updated dependencies [c527ea7]
  - @bamboocss/node@1.34.0
  - @bamboocss/types@1.34.0
  - @bamboocss/token-dictionary@1.34.0
  - @bamboocss/logger@1.34.0

## 1.33.0

### Patch Changes

- Updated dependencies [f7bbc14]
  - @bamboocss/types@1.33.0
  - @bamboocss/node@1.33.0
  - @bamboocss/logger@1.33.0
  - @bamboocss/token-dictionary@1.33.0

## 1.32.0

### Minor Changes

- da792cc: Replace `textStyles`, `layerStyles` and `animationStyles` with one `theme.mixins`.

  The three were one mechanism wearing three names: one registration, one cascade layer, and a `{ description?, value }`
  shape they all shared. They differed only in which css properties the value was allowed to set — a partition that was
  arbitrary at the edges (`color` was legal in a text style _and_ a layer style; `transform` in a layer style but
  `transformOrigin` only in an animation style) and costly in the middle, since a bundle wanting a font _and_ a border
  had to be split across two keys and applied twice.

  ```ts
  // before
  export default defineConfig({
    theme: { textStyles, layerStyles, animationStyles },
  })
  css({ textStyle: 'body' })
  css({ layerStyle: 'card' })

  // after
  export default defineConfig({ theme: { mixins } })
  css({ mixin: 'body' })
  css({ mixin: 'card' })
  ```

  - `defineTextStyles`, `defineLayerStyles` and `defineAnimationStyles` become `defineMixins`.
  - The `text-styles.json`, `layer-styles.json` and `animation-styles.json` specs become `mixins.json`, and the MCP
    tools `get_text_styles`, `get_layer_styles` and `get_animation_styles` become `get_mixins`.
  - Setting a property that does not exist is still an error. `Mixin` is built on the same property set `css()` uses
    rather than on `SystemStyleObject`, whose index signature would accept a typo — which is what the three allowlists
    were really protecting, and why one of them shipped `hypens` for as long as it did.
  - One namespace now holds every mixin, so prefix them by purpose — `text.body`, `layer.card` — if the flat list gets
    long. Nesting already supports this, and `DEFAULT` gives each group a bare name.

  A config still setting one of the three old keys fails with the replacement named, rather than reverting to the
  default in silence.

### Patch Changes

- Updated dependencies [c29044f]
- Updated dependencies [b0ed6dc]
- Updated dependencies [8a66bb9]
- Updated dependencies [591a0f1]
- Updated dependencies [da792cc]
- Updated dependencies [1cc1860]
- Updated dependencies [c29044f]
- Updated dependencies [b2b4173]
- Updated dependencies [f3a8b0d]
- Updated dependencies [c29044f]
  - @bamboocss/node@1.32.0
  - @bamboocss/types@1.32.0
  - @bamboocss/token-dictionary@1.32.0
  - @bamboocss/logger@1.32.0

## 1.31.0

### Patch Changes

- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [8fb87ac]
- Updated dependencies [cd5954c]
- Updated dependencies [9fdce28]
- Updated dependencies [678bdee]
- Updated dependencies [a72eb09]
- Updated dependencies [774048b]
  - @bamboocss/types@1.31.0
  - @bamboocss/node@1.31.0
  - @bamboocss/logger@1.31.0
  - @bamboocss/token-dictionary@1.31.0

## 1.30.1

### Patch Changes

- Updated dependencies [2634909]
  - @bamboocss/node@1.30.1
  - @bamboocss/logger@1.30.1
  - @bamboocss/token-dictionary@1.30.1
  - @bamboocss/types@1.30.1

## 1.30.0

### Patch Changes

- Updated dependencies
- Updated dependencies [009294f]
- Updated dependencies [242b24c]
  - @bamboocss/types@1.30.0
  - @bamboocss/node@1.30.0
  - @bamboocss/logger@1.30.0
  - @bamboocss/token-dictionary@1.30.0

## 1.29.0

### Patch Changes

- Updated dependencies [5e6eafe]
- Updated dependencies [a137758]
- Updated dependencies [0dbe9c4]
- Updated dependencies [6114f6e]
- Updated dependencies [38393c4]
  - @bamboocss/node@1.29.0
  - @bamboocss/types@1.29.0
  - @bamboocss/token-dictionary@1.29.0
  - @bamboocss/logger@1.29.0

## 1.28.1

### Patch Changes

- Updated dependencies [31749e1]
- Updated dependencies [be39dac]
  - @bamboocss/types@1.28.1
  - @bamboocss/logger@1.28.1
  - @bamboocss/node@1.28.1
  - @bamboocss/token-dictionary@1.28.1

## 1.28.0

### Patch Changes

- Updated dependencies [d7fc408]
  - @bamboocss/types@1.28.0
  - @bamboocss/node@1.28.0
  - @bamboocss/logger@1.28.0
  - @bamboocss/token-dictionary@1.28.0

## 1.27.0

### Patch Changes

- @bamboocss/node@1.27.0
- @bamboocss/logger@1.27.0
- @bamboocss/token-dictionary@1.27.0
- @bamboocss/types@1.27.0

## 1.26.0

### Patch Changes

- Updated dependencies [5e8814c]
  - @bamboocss/node@1.26.0
  - @bamboocss/logger@1.26.0
  - @bamboocss/token-dictionary@1.26.0
  - @bamboocss/types@1.26.0

## 1.25.0

### Patch Changes

- @bamboocss/node@1.25.0
- @bamboocss/logger@1.25.0
- @bamboocss/token-dictionary@1.25.0
- @bamboocss/types@1.25.0

## 1.24.0

### Patch Changes

- @bamboocss/logger@1.24.0
- @bamboocss/node@1.24.0
- @bamboocss/token-dictionary@1.24.0
- @bamboocss/types@1.24.0

## 1.23.0

### Patch Changes

- Updated dependencies [b041398]
  - @bamboocss/types@1.23.0
  - @bamboocss/node@1.23.0
  - @bamboocss/logger@1.23.0
  - @bamboocss/token-dictionary@1.23.0

## 1.22.0

### Patch Changes

- Updated dependencies [edb97e2]
- Updated dependencies [fe62614]
- Updated dependencies [41d9052]
- Updated dependencies [a1062c9]
- Updated dependencies [43ae8a7]
- Updated dependencies [0e6a4ee]
  - @bamboocss/node@1.22.0
  - @bamboocss/types@1.22.0
  - @bamboocss/logger@1.22.0
  - @bamboocss/token-dictionary@1.22.0

## 1.21.0

### Patch Changes

- @bamboocss/node@1.21.0
- @bamboocss/token-dictionary@1.21.0
- @bamboocss/types@1.21.0
- @bamboocss/logger@1.21.0

## 1.20.4

### Patch Changes

- @bamboocss/node@1.20.4
- @bamboocss/logger@1.20.4
- @bamboocss/token-dictionary@1.20.4
- @bamboocss/types@1.20.4

## 1.20.3

### Patch Changes

- @bamboocss/node@1.20.3
- @bamboocss/logger@1.20.3
- @bamboocss/token-dictionary@1.20.3
- @bamboocss/types@1.20.3

## 1.20.2

### Patch Changes

- Updated dependencies [8a73d2a]
  - @bamboocss/node@1.20.2
  - @bamboocss/logger@1.20.2
  - @bamboocss/token-dictionary@1.20.2
  - @bamboocss/types@1.20.2

## 1.20.1

### Patch Changes

- Updated dependencies [559924f]
  - @bamboocss/node@1.20.1
  - @bamboocss/logger@1.20.1
  - @bamboocss/token-dictionary@1.20.1
  - @bamboocss/types@1.20.1

## 1.20.0

### Patch Changes

- Updated dependencies [6512d6b]
- Updated dependencies [5d2c91c]
- Updated dependencies [0441724]
  - @bamboocss/node@1.20.0
  - @bamboocss/types@1.20.0
  - @bamboocss/token-dictionary@1.20.0
  - @bamboocss/logger@1.20.0

## 1.19.0

### Patch Changes

- @bamboocss/node@1.19.0
- @bamboocss/logger@1.19.0
- @bamboocss/token-dictionary@1.19.0
- @bamboocss/types@1.19.0

## 1.18.0

### Patch Changes

- Updated dependencies [070f9da]
  - @bamboocss/node@1.18.0
  - @bamboocss/token-dictionary@1.18.0
  - @bamboocss/types@1.18.0
  - @bamboocss/logger@1.18.0

## 1.17.3

### Patch Changes

- @bamboocss/types@1.17.3
- @bamboocss/node@1.17.3
- @bamboocss/logger@1.17.3
- @bamboocss/token-dictionary@1.17.3

## 1.17.2

### Patch Changes

- @bamboocss/node@1.17.2
- @bamboocss/logger@1.17.2
- @bamboocss/token-dictionary@1.17.2
- @bamboocss/types@1.17.2

## 1.17.1

### Patch Changes

- @bamboocss/node@1.17.1
- @bamboocss/token-dictionary@1.17.1
- @bamboocss/types@1.17.1
- @bamboocss/logger@1.17.1

## 1.17.0

### Patch Changes

- Updated dependencies [049a382]
- Updated dependencies [29f9bbe]
- Updated dependencies [7251bf8]
- Updated dependencies [355e573]
  - @bamboocss/node@1.17.0
  - @bamboocss/types@1.17.0
  - @bamboocss/token-dictionary@1.17.0
  - @bamboocss/logger@1.17.0

## 1.16.1

### Patch Changes

- @bamboocss/types@1.16.1
- @bamboocss/node@1.16.1
- @bamboocss/logger@1.16.1
- @bamboocss/token-dictionary@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [bb6d999]
- Updated dependencies [4877a67]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [645bb09]
- Updated dependencies [091f2e1]
- Updated dependencies [f2d5df2]
- Updated dependencies [1dbeb84]
- Updated dependencies [d7226f0]
- Updated dependencies [31d8577]
- Updated dependencies [2ab7f19]
- Updated dependencies [ca558fb]
- Updated dependencies [645bb09]
  - @bamboocss/node@1.16.0
  - @bamboocss/types@1.16.0
  - @bamboocss/token-dictionary@1.16.0
  - @bamboocss/logger@1.16.0

## 1.15.0

### Patch Changes

- Updated dependencies [3014989]
  - @bamboocss/types@1.15.0
  - @bamboocss/node@1.15.0
  - @bamboocss/token-dictionary@1.15.0
  - @bamboocss/logger@1.15.0

## 1.14.0

### Minor Changes

- f59d235: Ship the MCP server as a standalone package and drop it from `@bamboocss/dev`.

  `@bamboocss/mcp` was a dependency of the CLI, so every Bamboo install downloaded the Model Context Protocol SDK — and
  with it Express, Hono, `jose`, `ajv`, `cors` and a dozen more. It came to roughly 18 MB, against about 3 MB for
  ts-morph, postcss and lightningcss combined: the AI server outweighed the CSS toolchain several times over, in every
  project, whether or not anything ever started it.

  It now has its own binary and is fetched on demand:

  ```bash
  npx -y @bamboocss/mcp
  ```

  **`bamboo mcp` is gone.** It remains as a command only to say so — on stderr, since a stale config invokes it as the
  server and clients discard stdout. Run `bamboo init-mcp` again to rewrite your client config: the generated entry
  changes from `["bamboo", "mcp"]` to `["-y", "@bamboocss/mcp@<version>"]`.

  It is pinned rather than left to float. The server loads your config with its own copy of `@bamboocss/node`, and every
  `@bamboocss/*` package releases in lockstep, so an unpinned `latest` would read a pinned project's design system
  through a different release of the thing that defines it. Re-run `init-mcp` after upgrading Bamboo.

  **`bamboo init-mcp` is unaffected**, and still needs nothing beyond `@bamboocss/dev`. Writing a client config never
  touched the SDK, so that half moved into the CLI rather than out of reach; only starting the server needs the protocol
  dependencies.

  `@bamboocss/mcp` no longer exports `initMcpConfig`, `MCP_CLIENTS` or the client types — those belong to the CLI now —
  and no longer depends on `@clack/prompts`.

### Patch Changes

- Updated dependencies [b567114]
  - @bamboocss/types@1.14.0
  - @bamboocss/node@1.14.0
  - @bamboocss/logger@1.14.0
  - @bamboocss/token-dictionary@1.14.0

## 1.13.2

### Patch Changes

- @bamboocss/node@1.13.2
- @bamboocss/token-dictionary@1.13.2
- @bamboocss/types@1.13.2
- @bamboocss/logger@1.13.2

## 1.13.1

### Patch Changes

- @bamboocss/logger@1.13.1
- @bamboocss/node@1.13.1
- @bamboocss/token-dictionary@1.13.1
- @bamboocss/types@1.13.1

## 1.13.0

### Patch Changes

- Updated dependencies [a07286f]
- Updated dependencies [a5cb5a8]
- Updated dependencies [5b16a67]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
- Updated dependencies [5b881ee]
  - @bamboocss/types@1.13.0
  - @bamboocss/node@1.13.0
  - @bamboocss/token-dictionary@1.13.0
  - @bamboocss/logger@1.13.0

## 1.12.3

### Patch Changes

- @bamboocss/node@1.12.3
- @bamboocss/logger@1.12.3
- @bamboocss/token-dictionary@1.12.3
- @bamboocss/types@1.12.3

## 1.12.2

### Patch Changes

- @bamboocss/logger@1.12.2
- @bamboocss/node@1.12.2
- @bamboocss/token-dictionary@1.12.2
- @bamboocss/types@1.12.2

## 1.12.1

### Patch Changes

- @bamboocss/logger@1.12.1
- @bamboocss/node@1.12.1
- @bamboocss/token-dictionary@1.12.1
- @bamboocss/types@1.12.1

## 1.12.0

### Patch Changes

- @bamboocss/logger@1.12.0
- @bamboocss/node@1.12.0
- @bamboocss/token-dictionary@1.12.0
- @bamboocss/types@1.12.0

## 1.11.5

### Patch Changes

- @bamboocss/node@1.11.5
- @bamboocss/logger@1.11.5
- @bamboocss/token-dictionary@1.11.5
- @bamboocss/types@1.11.5

## 1.11.4

### Patch Changes

- fix pre-commit hook leaving dirty state after commit
- Updated dependencies
  - @bamboocss/logger@1.11.4
  - @bamboocss/node@1.11.4
  - @bamboocss/token-dictionary@1.11.4
  - @bamboocss/types@1.11.4

## 1.11.3

### Patch Changes

- fix shared package producing chunk files that break codegen output
- Updated dependencies
  - @bamboocss/logger@1.11.3
  - @bamboocss/node@1.11.3
  - @bamboocss/token-dictionary@1.11.3
  - @bamboocss/types@1.11.3

## 1.11.2

### Patch Changes

- 0f49103: migrate build to tsdown
- migrate to tsdown
- Updated dependencies [0f49103]
- Updated dependencies
  - @bamboocss/token-dictionary@1.11.2
  - @bamboocss/logger@1.11.2
  - @bamboocss/types@1.11.2
  - @bamboocss/node@1.11.2

## 1.11.1

### Patch Changes

- fe9c11c: Bump `@modelcontextprotocol/sdk` from `^1.25.2` to `^1.29.0`.
- Updated dependencies [2f29aa6]
- Updated dependencies [2ea9205]
  - @bamboocss/node@1.11.1
  - @bamboocss/types@1.11.1
  - @bamboocss/logger@1.11.1
  - @bamboocss/token-dictionary@1.11.1

## 1.11.0

### Patch Changes

- Updated dependencies [78869ae]
  - @bamboocss/types@1.11.0
  - @bamboocss/node@1.11.0
  - @bamboocss/logger@1.11.0
  - @bamboocss/token-dictionary@1.11.0

## 1.10.0

### Patch Changes

- bc2b8d7: Dependency updates for reported security advisories.
  - **@bamboocss/node** / **@bamboocss/token-dictionary**: bump `picomatch` to 4.0.4
    ([GHSA-3v7f-55p6-f55p](https://github.com/advisories/GHSA-3v7f-55p6-f55p),
    [GHSA-c2c7-rcm5-vvqj](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)).
  - **@bamboocss/mcp**: bump `@modelcontextprotocol/sdk` to ^1.25.2.
  - **@bamboocss/astro-plugin-studio**: bump `astro` (dev) to 5.18.1.

- Updated dependencies [c31f3a2]
- Updated dependencies [bbaa8b3]
- Updated dependencies [22b444d]
- Updated dependencies [bc2b8d7]
- Updated dependencies [8d3b6f8]
- Updated dependencies [44457bb]
  - @bamboocss/types@1.10.0
  - @bamboocss/logger@1.10.0
  - @bamboocss/node@1.10.0
  - @bamboocss/token-dictionary@1.10.0

## 1.9.1

### Patch Changes

- Updated dependencies [d02fcf6]
  - @bamboocss/token-dictionary@1.9.1
  - @bamboocss/node@1.9.1
  - @bamboocss/logger@1.9.1
  - @bamboocss/types@1.9.1

## 1.9.0

### Patch Changes

- @bamboocss/node@1.9.0
- @bamboocss/logger@1.9.0
- @bamboocss/token-dictionary@1.9.0
- @bamboocss/types@1.9.0

## 1.8.2

### Patch Changes

- Updated dependencies [331d1a5]
  - @bamboocss/types@1.8.2
  - @bamboocss/logger@1.8.2
  - @bamboocss/node@1.8.2
  - @bamboocss/token-dictionary@1.8.2

## 1.8.1

### Patch Changes

- Updated dependencies [3c86c29]
  - @bamboocss/types@1.8.1
  - @bamboocss/logger@1.8.1
  - @bamboocss/node@1.8.1
  - @bamboocss/token-dictionary@1.8.1

## 1.8.0

### Minor Changes

- d7e46e0: **MCP Server [NEW]**: Added MCP server that exposes tools for AI agents.

  ```sh
  bamboo init-mcp
  ```

  Available tools: `get_tokens`, `get_semantic_tokens`, `get_recipes`, `get_patterns`, `get_conditions`,
  `get_text_styles`, `get_layer_styles`, `get_keyframes`, `get_config`, `get_usage_report`.

### Patch Changes

- @bamboocss/logger@1.8.0
- @bamboocss/node@1.8.0
- @bamboocss/token-dictionary@1.8.0
- @bamboocss/types@1.8.0
