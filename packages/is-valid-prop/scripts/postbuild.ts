import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const fileMap = [['index.mjs', 'is-valid-prop.mjs']]

async function main() {
  fileMap.forEach(([input, outfile]) => {
    const inputPath = join(__dirname, '..', 'dist', input)
    const content = readFileSync(inputPath, 'utf8')

    const packagesDir = join(__dirname, '..', '..')
    const generatorPath = join(packagesDir, 'generator')
    const outPath = join(generatorPath, 'src', 'artifacts', 'generated', outfile + '.json')
    // Trailing newline, so the formatter has nothing to add and a build leaves the
    // tree clean. See the note in `packages/shared/scripts/postbuild.ts`.
    writeFileSync(outPath, JSON.stringify({ content }, null, 2) + '\n', 'utf8')
  })
  console.log('[postbuild] Copied code to packages/generator/src/artifacts ✅')
}

main()
