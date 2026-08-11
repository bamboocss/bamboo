import type { ArtifactId, ConfigPath } from '@bamboocss/types'
import { createMatcher } from './create-matcher'

// Below is the list of all the config paths that can affect an artifact generation
// For some, such as recipes/patterns we'll specify which item was specifically affected (e.g. recipes.xxx-yyy)
// so we can avoid generating/re-writing all the other artifacts of the same kind (e.g. recipes.aaa, recipes.bbb, etc.) that didn't change

// `ConfigPath` ends in `(string & {})`, so a path here that no longer exists still typechecks
// and simply stops matching. Anything removed from the config has to be removed from these
// lists by hand — nothing else notices, and the symptom is an artifact that quietly stops
// being regenerated on the edit that should have rebuilt it.
const all: ConfigPath[] = [
  'clean',
  'cwd',
  'outdir',
  'forceConsistentTypeExtension',
  'outExtension',
  'emitTokensOnly',
  'presets',
  'plugins',
]

const format: ConfigPath[] = ['hash', 'prefix', 'separator', 'strictTokens', 'strictPropertyValues', 'shorthands']

const tokens: ConfigPath[] = [
  'utilities',
  'conditions',
  'theme.tokens',
  'theme.semanticTokens',
  'theme.breakpoints',
  'theme.containerNames',
  'theme.containerSizes',
]

const common = tokens.concat(format)

const artifactConfigDeps: Record<ArtifactId, ConfigPath[]> = {
  helpers: [],
  keyframes: ['theme.keyframes', 'layers'],
  'design-tokens': ['layers', '!utilities.*.className'].concat(tokens),
  types: ['!utilities.*.className'].concat(common),
  'css-fn': common,
  cva: [],
  sva: [],
  cx: [],
  'create-recipe': ['separator', 'prefix', 'hash'],
  'recipes-index': ['theme.recipes', 'theme.slotRecipes'],
  recipes: ['theme.recipes', 'theme.slotRecipes'],
  'patterns-index': ['patterns'],
  patterns: ['patterns'],
  'css-index': [],
  'package.json': ['forceConsistentTypeExtension', 'outExtension'],
  'types-styles': ['shorthands'],
  'types-conditions': ['conditions'],
  'types-entry': [],
  'types-gen': [],
  'types-gen-system': [],
  // `theme.variants`, which this called `themes` until the option was renamed. The old spelling
  // matched nothing, so editing a variant's tokens rebuilt no artifact at all — and an empty
  // affected set is not "rebuild everything", it is `ids.includes()` filtering every artifact
  // out. A watch rebuild kept serving the previous `theme-*.json`.
  themes: ['theme.variants'].concat(tokens),
  // staticCss depends on tokens (for wildcards) and recipes (for recipe rules)
  'static-css': ['staticCss', 'patterns', 'theme.recipes', 'theme.slotRecipes'].concat(tokens),
  // Split CSS artifacts (generated via cssgen --splitting)
  styles: [],
  'styles.css': [],
}

// Prepare a list of regex that resolves to an artifact id from a list of config paths
export const artifactMatchers = Object.entries(artifactConfigDeps).map(([key, paths]) => {
  if (!paths.length) return () => undefined
  return createMatcher(key, paths.concat(all))
})

/**
 * Every config path any artifact watches, deduped.
 *
 * Exported for `config-deps.test.ts`, which checks each one against the removed-option table —
 * the only thing standing between a renamed option and an artifact that quietly stops
 * rebuilding. `eject` and `themes` both outlived their options here.
 */
export const configDepPaths = Array.from(new Set([...all, ...Object.values(artifactConfigDeps).flat()]))
