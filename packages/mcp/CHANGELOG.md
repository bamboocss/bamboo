# @bamboocss/mcp

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
