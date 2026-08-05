#!/usr/bin/env node

// The failure has to reach stderr by hand. `runMcpCli` silences the logger so that nothing
// pollutes stdout, which is the protocol channel — and `@bamboocss/node` routes unhandled
// rejections through that same logger, so without this a missing config exits 0 having
// written nothing to either stream, and the client sees a server that started and stopped.
require(`./dist/cli.cjs`)
  .runMcpCli()
  .catch((error) => {
    process.stderr.write(`${error?.stack ?? error}\n`)
    process.exitCode = 1
  })
