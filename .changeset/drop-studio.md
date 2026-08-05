---
'@bamboocss/dev': minor
'@bamboocss/types': minor
'@bamboocss/core': minor
'@bamboocss/node': minor
'@bamboocss/shared': minor
---

Drop `@bamboocss/studio` and `@bamboocss/astro-plugin-studio`.

Studio was the visual token browser inherited from Panda — an Astro site that read your config and rendered your colors,
typography and spacing. It is no longer maintained, and both packages are removed from the repository. The versions
already on npm stay there and keep working; they will not receive further releases.

**`bamboo studio` is gone.** Its own flags — `--build`, `--preview`, `--port`, `--host`, `--outdir` and `--base` — have
no replacement. If you have it in a `package.json` script, remove the script.

**`config.studio` is gone**, along with the `StudioOptions` type. Leaving `studio: { logo, outdir, inject }` in a config
is now a TypeScript error rather than a silent no-op, so delete it — a plain-JS config will keep ignoring it.
`Context.studio` is removed from `@bamboocss/core`, and the `MISSING_STUDIO` error code from `@bamboocss/shared`'s
`BambooErrorCode` union.

The studio output directory is no longer written to `.gitignore` by `bamboo init`. Existing `.gitignore` files keep
their `styled-system-studio` line until you remove it, which is harmless — nothing writes there anymore.

For documenting a design system, [spec files](/docs/theming/spec) generate a machine-readable description of your
tokens, recipes and patterns that you can render however you like, and the [MCP server](/docs/ai/mcp-server) exposes the
same information to AI tooling.
