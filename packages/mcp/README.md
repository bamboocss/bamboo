# @bamboocss/mcp

MCP server for [Bamboo CSS](https://bamboocss.com). Exposes your project's design system — tokens, recipes, patterns,
conditions and usage reports — to AI assistants that speak the
[Model Context Protocol](https://modelcontextprotocol.io/).

## Usage

You do not normally install this. Run `bamboo init-mcp` in your project and it writes a config for your AI client that
starts the server on demand, pinned to the Bamboo version that generated it:

```json
{
  "mcpServers": {
    "bamboo": {
      "command": "npx",
      "args": ["-y", "@bamboocss/mcp@<version>"]
    }
  }
}
```

To run it by hand:

```bash
npx -y @bamboocss/mcp [--config <path>] [--cwd <dir>]
```

It speaks MCP over stdio and loads `bamboo.config.ts` from the working directory.

## Why it is a separate package

The protocol SDK depends on an HTTP server and a JOSE implementation, which come to roughly 18 MB — several times the
weight of Bamboo's CSS toolchain. Shipping it inside `@bamboocss/dev` would put all of that in every project, including
the ones that never start an AI client. Kept here, it is downloaded only when something actually asks for it.

## Documentation

[bamboocss.com/docs/ai/mcp-server](https://bamboocss.com/docs/ai/mcp-server)
