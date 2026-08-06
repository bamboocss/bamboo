import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const fileMap = [['shared.mjs', 'helpers.mjs']]

async function main() {
  fileMap.forEach(([input, outfile]) => {
    const inputPath = join(__dirname, '..', 'dist', input)
    const content = readFileSync(inputPath, 'utf8')

    const packagesDir = join(__dirname, '..', '..')
    const generatorPath = join(packagesDir, 'generator')
    const outPath = join(generatorPath, 'src', 'artifacts', 'generated', outfile + '.json')
    // Trailing newline so the formatter has nothing to add. Without it every build
    // and every `pnpm fmt:fix` flip these files back and forth, and a plain
    // `pnpm build` leaves a dirty tree.
    writeFileSync(outPath, JSON.stringify({ content }, null, 2) + '\n', 'utf8')
  })
  console.log('[postbuild] Copied shared to packages/generator/src/artifacts ✅')
}

main()
