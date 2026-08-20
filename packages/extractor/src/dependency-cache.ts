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
  /** The dependency-generation the computation completed under; see `invalidateDependencyPath`. */
  generation: number
  value: T
}

/**
 * Per-path staleness, so an edit invalidates exactly the entries that read the edited file.
 *
 * The caches these entries live in are `WeakMap`s keyed on AST nodes — deliberately, so a
 * retired tree releases its memory — which means they cannot be swept. What they *can* do is
 * refuse a hit: every entry already records the module paths its computation read, because
 * that same record is what the watch system replays into fold dependencies. Stamping entries
 * with a creation generation and bumping a per-path generation on each edit turns the
 * recorded read-set into a validity check, evaluated lazily at lookup.
 *
 * The trust base is unchanged. If a cross-file read were missing from `dependencies`, the
 * fold's watch edges would already be missing it, and editing that file would fail to
 * re-transform its consumers today — the recorded read-set is load-bearing for invalidation
 * breadth before it is for cache validity.
 *
 * An entry's *own* file needs no record: reloading or overwriting a file re-parses it, which
 * retires every node previously taken from it, and a retired node can never be a lookup key
 * again. Only cross-file reads can go stale while the key survives, and those are exactly
 * what the capture records.
 *
 * File-tree changes are not handled here at all: a created or deleted file can change what a
 * specifier *resolves to* without any recorded path's content moving, so those events keep
 * clearing the caches outright, exactly as before.
 */
let dependencyGeneration = 1
const invalidatedAt = new Map<string, number>()

/** Mark one edited file's content stale for every cache entry that recorded reading it. */
export const invalidateDependencyPath = (filePath: string) => {
  dependencyGeneration++
  invalidatedAt.set(filePath.replaceAll('\\', '/'), dependencyGeneration)
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
        generation: dependencyGeneration,
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
  // A recorded read of a file edited since this entry was computed makes the value suspect;
  // the miss recomputes it from the current tree, exactly as a full clear would have.
  for (const dependency of entry.dependencies) {
    const at = invalidatedAt.get(dependency)
    if (at !== undefined && at > entry.generation) return { hit: false as const }
  }
  for (const dependency of entry.dependencies) recordModuleDependency(ctx, dependency)
  return { hit: true as const, value: entry.value }
}
