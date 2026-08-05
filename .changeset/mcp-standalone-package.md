---
'@bamboocss/dev': minor
'@bamboocss/mcp': minor
---

Ship the MCP server as a standalone package and drop it from `@bamboocss/dev`.

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
`@bamboocss/*` package releases in lockstep, so an unpinned `latest` would read a pinned project's design system through
a different release of the thing that defines it. Re-run `init-mcp` after upgrading Bamboo.

**`bamboo init-mcp` is unaffected**, and still needs nothing beyond `@bamboocss/dev`. Writing a client config never
touched the SDK, so that half moved into the CLI rather than out of reach; only starting the server needs the protocol
dependencies.

`@bamboocss/mcp` no longer exports `initMcpConfig`, `MCP_CLIENTS` or the client types — those belong to the CLI now —
and no longer depends on `@clack/prompts`.
