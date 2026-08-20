import type { BoxContext, ResolveModule } from './types'

const EMPTY_DEPENDENCIES: readonly string[] = []

interface DependencyFrame {
  dependencies?: Set<string>
}

interface DependencyTracker {
  frames: DependencyFrame[]
}

/** One synchronous extraction context owns one nested capture stack. */
const trackers = new WeakMap<BoxContext, DependencyTracker>()

export interface DependencyCacheEntry<T> {
  dependencies: readonly string[]
  resolveModule: ResolveModule | undefined
  value: T
}

/**
 * Attribute one resolved local module to every cache computation currently enclosing it.
 *
 * Paths, rather than SourceFile objects, are the replay payload. A source replacement may
 * retire every node in a file, while its stable path is exactly the fact a fresh ParserResult
 * needs. The caller-facing callback stays outside the cache and therefore belongs to the
 * current query/environment rather than whichever parse populated the entry.
 */
export const recordModuleDependency = (ctx: BoxContext, filePath: string) => {
  const normalized = filePath.replaceAll('\\', '/')
  const tracker = trackers.get(ctx)
  if (tracker) {
    for (const frame of tracker.frames) {
      frame.dependencies ??= new Set()
      frame.dependencies.add(normalized)
    }
  }
  ctx.recordDependency?.(normalized)
}

/** Begin one nested cache computation without allocating a Set on dependency-free paths. */
export const beginDependencyCapture = (ctx: BoxContext) => {
  let tracker = trackers.get(ctx)
  if (!tracker) {
    tracker = { frames: [] }
    trackers.set(ctx, tracker)
  }
  const frame: DependencyFrame = {}
  tracker.frames.push(frame)

  return {
    entry<T>(value: T): DependencyCacheEntry<T> {
      return {
        dependencies: frame.dependencies ? [...frame.dependencies].sort() : EMPTY_DEPENDENCIES,
        resolveModule: ctx.resolveModule,
        value,
      }
    },
    end() {
      tracker.frames.pop()
    },
  }
}

/**
 * Replay a hit only inside the resolver scope which computed it.
 *
 * The same ts-morph node can be inspected under two extractor contexts with different module
 * placement rules. Returning the first context's value or dependency paths to the second would
 * be cross-Project leakage, so a scope mismatch is a cache miss and gets overwritten normally.
 */
export const replayDependencyCache = <T>(entry: DependencyCacheEntry<T>, ctx: BoxContext) => {
  if (entry.resolveModule !== ctx.resolveModule) return { hit: false as const }
  for (const dependency of entry.dependencies) recordModuleDependency(ctx, dependency)
  return { hit: true as const, value: entry.value }
}
