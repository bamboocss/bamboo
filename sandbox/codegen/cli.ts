#!/usr/bin/env node

import cac from 'cac'
import { spawn } from 'child_process'

const cli = cac('sct')
const scenarioList = ['strict-tokens', 'strict-property-values', 'strict', 'format-names', 'grouped']

const isValidScenario = (scenario) => {
  if (!scenarioList.includes(scenario)) {
    console.log(`Unknown scenario: ${scenario}`)
    return false
  }
  return true
}

const runCommand = (command: string, envVars = {}) => {
  return new Promise((resolve, reject) => {
    const [cmd, ...args] = command.split(' ')
    const proc = spawn(cmd, args, {
      env: { ...process.env, ...envVars },
      stdio: 'inherit',
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        console.error(`Command failed with exit code ${code}`)
        reject()
        return
      }
      resolve(0)
    })
  })
}

cli.command('').action(() => {
  return cli.outputHelp()
})

cli
  .command('test [scenario]', 'Run tests')
  .option('-u, --update', 'Update snapshots')
  .option('-w, --watch', 'Watch mode')
  .option('-t, --typecheck', 'Enable typecheck')
  .action(async (scenario, options) => {
    if (scenario && !isValidScenario(scenario)) return

    const commands = (scenario ? [scenario] : scenarioList).map((fw) => ({
      cmd: `pnpm vitest${options.update ? ' -u' : ''}${options.watch ? '' : ' run'}`,
      env: { MODE: fw, TYPECHECK: options.typecheck ? 1 : undefined },
    }))

    for (const command of commands) {
      try {
        await runCommand(command.cmd, command.env)
      } catch {
        console.error('Some commands failed:')
        process.exit(1)
      }
    }

    console.log('All commands succeeded 🎉')
  })

cli.command('codegen [scenario]', 'Generate code').action(async (scenario) => {
  if (scenario && !isValidScenario(scenario)) return

  const commands = (scenario ? [scenario] : scenarioList).map(
    (fw) => `pnpm bamboo codegen --clean --config bamboo.${fw}.config.ts`,
  )

  // The default config, whose `outdir` is the base `styled-system` that every non-scenario
  // test in `__tests__` imports from — and `packages/vite`'s recipe parity test with it.
  //
  // Not a scenario, and easy to forget it is generated here at all: it used to fall out of
  // the `react` scenario, whose config also wrote to `styled-system`. Removing that scenario
  // took the base directory with it, and nothing failed locally because the directory was
  // already on disk from an earlier run. CI installs from scratch, so `prepare` is the only
  // thing that creates it there.
  if (!scenario) commands.push('pnpm bamboo codegen --clean')

  await Promise.all(commands.map(runCommand))

  // The grouped scenario asserts that every class its runtime returns has a rule behind it,
  // so it needs the emitted stylesheet as well as the generated artifacts. `codegen` writes
  // one without the other.
  if (!scenario || scenario === 'grouped') {
    await runCommand('pnpm bamboo cssgen --config bamboo.grouped.config.ts')
    // A second copy under an extension vite will not treat as CSS. The scenario's test
    // imports the stylesheet with `?raw` to compare it against the generated runtime, and
    // vite's CSS pipeline intercepts `?raw` on a `.css` file and hands back an empty string.
    // Reading it with `node:fs` instead would typecheck against a tsconfig that has no node
    // types — and vitest's typecheck runs over the whole project, so no scenario can opt out.
    await runCommand(
      'pnpm bamboo cssgen --config bamboo.grouped.config.ts --outfile styled-system-grouped/styles.css.txt',
    )
  }
})

cli.help()
cli.parse(process.argv, { run: false })

try {
  await cli.runMatchedCommand()
} catch (error) {
  console.error(error.stack)
  process.exit(1)
}
