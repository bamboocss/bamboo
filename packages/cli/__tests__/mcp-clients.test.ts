import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { version } from '../package.json'
import { CLIENT_NAMES, generateMcpConfig, getClientConfig, isValidClient, MCP_CLIENTS } from '../src/mcp-clients'

const here = dirname(fileURLToPath(import.meta.url))

describe('mcp client configs', () => {
  test('the generated server entry starts the standalone package, pinned', () => {
    // Not `npx bamboo mcp`. The server lives in `@bamboocss/mcp` so that installing Bamboo does
    // not drag the Model Context Protocol SDK — and its HTTP server and JOSE dependencies —
    // into every project. Pinned because it loads the project's config with its own copy of
    // `@bamboocss/node`, and every `@bamboocss/*` package releases in lockstep.
    expect(generateMcpConfig(getClientConfig('claude'), version)).toEqual({
      mcpServers: {
        bamboo: { command: 'npx', args: ['-y', `@bamboocss/mcp@${version}`] },
      },
    })
  })

  test('vs code nests under servers rather than mcpServers', () => {
    expect(generateMcpConfig(getClientConfig('vscode'), version)).toEqual({
      servers: {
        bamboo: { command: 'npx', args: ['-y', `@bamboocss/mcp@${version}`] },
      },
    })
  })

  test('every client generates under the key it declares', () => {
    for (const client of CLIENT_NAMES) {
      const config = getClientConfig(client)
      expect(Object.keys(generateMcpConfig(config, version))).toEqual([config.configKey])
    }
  })

  test('the clients Bamboo claims to support are the ones it can configure', () => {
    // Spelled out rather than derived from `MCP_CLIENTS`: deriving it makes the assertion
    // tautological, and dropping a client would read as green.
    expect(CLIENT_NAMES).toEqual(['claude', 'cursor', 'vscode', 'windsurf', 'codex'])
    expect(CLIENT_NAMES.map((c) => MCP_CLIENTS[c].configPath)).toEqual([
      '.mcp.json',
      '.cursor/mcp.json',
      '.vscode/mcp.json',
      '.windsurf/mcp.json',
      '.codex/mcp.json',
    ])
  })

  test('client names round-trip through validation', () => {
    for (const client of CLIENT_NAMES) expect(isValidClient(client)).toBe(true)
    expect(isValidClient('emacs')).toBe(false)
  })
})

describe('@bamboocss/dev does not depend on the mcp package', () => {
  const pkg = JSON.parse(readFileSync(join(here, '../package.json'), 'utf8'))

  test('not in dependencies', () => {
    // The whole point of the split: `@bamboocss/mcp` carries ~18 MB of transitive
    // dependencies — several times the weight of the CSS toolchain — for a server most
    // projects never start.
    expect(Object.keys(pkg.dependencies ?? {})).not.toContain('@bamboocss/mcp')
    expect(Object.keys(pkg.devDependencies ?? {})).not.toContain('@bamboocss/mcp')
  })

  test('no source file imports it', () => {
    // The directory is read rather than listed, so a new file is covered the day it lands —
    // the entry point `cli-default.ts` was missing from the list this replaces.
    const dir = join(here, '../src')
    const sources = readdirSync(dir).filter((file) => file.endsWith('.ts'))
    expect(sources).toContain('cli-default.ts')

    // Bare `import '…'` counts too, which is how a module with side effects arrives.
    const forbidden =
      /(?:from\s*|import\s*\(\s*|require\s*\(\s*|import\s+)['"](@bamboocss\/mcp|@modelcontextprotocol[^'"]*)['"]/

    for (const file of sources) {
      expect(readFileSync(join(dir, file), 'utf8').match(forbidden)?.[1], file).toBeUndefined()
    }
  })
})
