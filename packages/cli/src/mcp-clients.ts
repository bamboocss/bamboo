export type McpClient = 'claude' | 'cursor' | 'vscode' | 'windsurf' | 'codex'

export interface McpClientConfig {
  name: string
  label: string
  configPath: string
  configKey: 'mcpServers' | 'servers'
}

export const MCP_CLIENTS: Record<McpClient, McpClientConfig> = {
  claude: {
    name: 'claude',
    label: 'Claude (.mcp.json)',
    configPath: '.mcp.json',
    configKey: 'mcpServers',
  },
  cursor: {
    name: 'cursor',
    label: 'Cursor (.cursor/mcp.json)',
    configPath: '.cursor/mcp.json',
    configKey: 'mcpServers',
  },
  vscode: {
    name: 'vscode',
    label: 'VS Code (.vscode/mcp.json)',
    configPath: '.vscode/mcp.json',
    configKey: 'servers',
  },
  windsurf: {
    name: 'windsurf',
    label: 'Windsurf (.windsurf/mcp.json)',
    configPath: '.windsurf/mcp.json',
    configKey: 'mcpServers',
  },
  codex: {
    name: 'codex',
    label: 'Codex (.codex/mcp.json)',
    configPath: '.codex/mcp.json',
    configKey: 'mcpServers',
  },
}

export const CLIENT_NAMES = Object.keys(MCP_CLIENTS) as McpClient[]

export function isValidClient(client: string): client is McpClient {
  return CLIENT_NAMES.includes(client as McpClient)
}

export function getClientConfig(client: McpClient): McpClientConfig {
  return MCP_CLIENTS[client]
}

/**
 * The server is started through `npx` rather than through this CLI.
 *
 * `@bamboocss/mcp` carries the Model Context Protocol SDK, which brings an HTTP server and a
 * JOSE implementation with it — around 18 MB, several times the weight of the CSS toolchain,
 * for a feature most projects never start. Keeping it out of `@bamboocss/dev` means an install
 * only pays for it when a client actually launches the server.
 *
 * `-y` so npx fetches it without prompting the first time.
 *
 * Pinned to this CLI's version rather than left to float. The server loads the project's config
 * with its own copy of `@bamboocss/node`, and every `@bamboocss/*` package releases in lockstep,
 * so an unpinned `latest` would read a pinned project's design system through a different
 * release of the thing that defines it. Re-run `bamboo init-mcp` after upgrading.
 */
export function generateMcpConfig(clientConfig: McpClientConfig, version: string) {
  const serverConfig = {
    command: 'npx',
    args: ['-y', `@bamboocss/mcp@${version}`],
  }

  return {
    [clientConfig.configKey]: {
      bamboo: serverConfig,
    },
  }
}
