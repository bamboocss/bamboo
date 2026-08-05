import { startMcpServer } from './server'

const HELP = `bamboo-mcp — MCP server for Bamboo CSS

Usage
  npx -y @bamboocss/mcp [options]

Options
  -c, --config <path>  Path to the bamboo config file
      --cwd <dir>      Directory to load the config from (default: .)
  -h, --help           Show this message

The server speaks MCP over stdio, so it is normally started by an AI client from
the config \`bamboo init-mcp\` writes rather than run by hand.
`

/**
 * Reads only what the generated client configs pass, which is why this is hand-rolled rather
 * than another `cac` dependency: the point of shipping this separately is that installing it
 * pulls in as little as possible.
 */
export function parseArgs(argv: readonly string[]) {
  const options: { cwd?: string; config?: string; help?: boolean } = {}

  // A flag whose value is missing or empty has to be an error for the same reason an unknown
  // flag is: both would otherwise fall through to the defaults and serve a different project's
  // design system than the one that was asked for.
  const value = (flag: string, raw: string | undefined) => {
    if (!raw) throw new Error(`Missing value for ${flag}`)
    return raw
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]

    if (arg === '-h' || arg === '--help') options.help = true
    else if (arg === '-c' || arg === '--config') options.config = value(arg, argv[++i])
    else if (arg === '--cwd') options.cwd = value(arg, argv[++i])
    else if (arg?.startsWith('--config=')) options.config = value('--config', arg.slice('--config='.length))
    else if (arg?.startsWith('--cwd=')) options.cwd = value('--cwd', arg.slice('--cwd='.length))
    else throw new Error(`Unknown option: ${arg}`)
  }

  return options
}

export async function runMcpCli(argv: readonly string[] = process.argv.slice(2)) {
  let options: ReturnType<typeof parseArgs>

  try {
    options = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${(error as Error).message}\n\n${HELP}`)
    process.exitCode = 1
    return
  }

  if (options.help) {
    process.stdout.write(HELP)
    return
  }

  // stdout is the transport, so the server is asked not to log to it. That holds unless
  // `BAMBOO_DEBUG` is set to anything but `*`, which forces the level back to debug.
  await startMcpServer({ ...options, silent: true })
}
