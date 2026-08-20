import { esc } from '@bamboocss/shared'

export interface StaticOutputProjection {
  /** Whether this environment's current graph imports the virtual stylesheet. */
  cssLoaded: boolean
  /** Compiler-owned atoms every JavaScript output represented by this projection can name. */
  requiredClasses: ReadonlySet<string>
  /** Restore the committed whole-build projection after the candidate CSS has been staged. */
  restore(): void
}

/** Shared state between the build-time fold and the virtual CSS module. */
export interface StaticCompilationSession {
  /** Resolved CSS layer name that carries generated atomic utilities. */
  utilityLayer: string
  /** Vite output sourcemap mode, needed if a late asset reference changes chunk text. */
  sourcemap: boolean | 'inline' | 'hidden'
  /** Whether the virtual stylesheet was actually imported by this build. */
  cssLoaded: boolean
  /** Source modules whose Bamboo styles were compiled into emitted class values. */
  transformedFiles: Set<string>
  /** Source modules covered by Bamboo's configured extraction graph. */
  extractedFiles: Set<string>
  /** Escaped selectors emitted from the source graph and therefore safe to tree-shake. */
  prunableClasses: Set<string>
  /** Raw semantic classes used by `view-transition-class` declarations as well as selectors. */
  viewTransitionClasses: Set<string>
  /** Escaped selectors the transformed Rollup graph can actually emit. */
  usedClasses: Set<string>
  /**
   * Project one prepared environment while Bamboo finalizes that environment's output.
   *
   * The default implementation owns the simple prune-history reset used by isolated CSS-hook
   * callers. The compiler replaces it with the production transaction: the returned callback
   * restores the committed projection after the CSS hook has staged the candidate bundle, and a
   * later output-success hook publishes its reachability and prune history together.
   */
  beginOutputProjection: (
    environment: string,
    outputOptions: object,
    bundle: object,
    replacesGeneratedStylesheet: boolean,
  ) => StaticOutputProjection
  /**
   * Every environment this run intends to build, when the run says so before building any.
   *
   * `undefined` means nothing announced one, which is the single-environment shape: `vite
   * build` without `builder`, and the `build()` API, each set up exactly one environment.
   * Reachability is complete the moment that one finishes, so pruning goes ahead.
   */
  expectedEnvironments: Set<string> | undefined
  /** Environments that have entered this shared plugin instance at least once. */
  participatingEnvironments: Set<string>
  /** Environments whose latest generation reached its observable output commit point. */
  completedEnvironments: Set<string>
  /**
   * Escape-free class names a completed prune removed from an emitted stylesheet.
   *
   * Kept so a later environment can notice that a class it just compiled is already gone from
   * a sheet that has been finalized. Escape-free because that is the spelling the prune pass
   * decides on; see `bare` there.
   */
  prunedClasses: Set<string>
  markClassUsed(className: string): void
}

export const createStaticCompilationSession = (): StaticCompilationSession => {
  const session: StaticCompilationSession = {
    utilityLayer: 'utilities',
    sourcemap: false,
    cssLoaded: false,
    transformedFiles: new Set(),
    extractedFiles: new Set(),
    prunableClasses: new Set(),
    viewTransitionClasses: new Set(),
    usedClasses: new Set(),
    expectedEnvironments: undefined,
    participatingEnvironments: new Set(),
    completedEnvironments: new Set(),
    prunedClasses: new Set(),
    beginOutputProjection(_environment, _outputOptions, _bundle, replacesGeneratedStylesheet) {
      if (replacesGeneratedStylesheet) session.prunedClasses.clear()
      const prunable = new Set([...session.prunableClasses].map((className) => className.replaceAll('\\', '')))
      const requiredClasses = new Set(
        [...session.usedClasses].filter((className) => prunable.has(className.replaceAll('\\', ''))),
      )
      return { cssLoaded: session.cssLoaded, requiredClasses, restore() {} }
    },
    markClassUsed(className) {
      // Split on whitespace. A folded call reports one entry per call
      // site, and a call producing several atoms reports them space-joined — every property
      // under one condition, which is why `_before: { content, width }` arrives as a single
      // string. Escaping that whole string yielded one key containing a space, matching no
      // class, so both atoms were left unmarked and reachability pruning deleted them.
      //
      // It read as "conditional styles are compiled into class names whose rules are never
      // emitted", and it fell hardest on pseudo-elements: `content` almost always travels
      // with another property, so `::before` and `::after` disappeared outright, while
      // single-declaration hovers and breakpoints survived and multi-declaration ones did
      // not. An atom that merged into a multi-class selector escaped the prune by accident,
      // which is why some of the rules were still there.
      for (const token of className.split(' ')) {
        if (!token) continue
        // Stored in selector form because the CSS reachability pass reads escaped selectors.
        //
        // Escaped at most once. `esc` is idempotent for a name that needs no escaping —
        // `d_flex` survives any number of passes — but not otherwise: `--scrollbar-width_10px`
        // becomes `\--scrollbar-width_10px` and then `\\--scrollbar-width_10px`. A second
        // pass therefore produces a key matching no rule, and it does so *only* for names that
        // need escaping: custom properties, vendor-prefixed properties, anything with a
        // leading dash. Those are exactly the classes one project reported as having no rule
        // in the sheet while the rule was plainly there.
        //
        // A semantic atom name never contains a literal backslash, so one is an unambiguous
        // signal that this name is already in selector form and must be left alone.
        session.usedClasses.add(token.includes('\\') ? token : esc(token))
      }
    },
  }
  return session
}

/**
 * Expected or observed environments whose current generation has not completed yet.
 *
 * Empty means everything the run will contribute has been contributed, which is the condition
 * every whole-run judgement here waits for: pruning the stylesheet against reachability, and
 * the two guards that ask whether the compiled modules and the extraction graph agree. Each of
 * those is false about a build in progress and true only about a finished one.
 *
 * The environment currently at `buildEnd` may be supplied as the candidate completing this
 * call. That keeps publication transactional: whole-run checks can include its finished graph
 * without marking it complete before those checks themselves succeed.
 *
 * Empty is also the answer for a single-environment build, where the only participant is the
 * completing candidate — so that path is unchanged.
 *
 * An environment a run declares and then never builds leaves this permanently non-empty, and
 * those judgements are skipped for the run. Every one of them errs towards shipping more CSS
 * or asserting less, so that is the safe direction to be wrong in.
 */
export const remainingEnvironments = (
  session: StaticCompilationSession,
  /** A generation currently proving it can complete this `buildEnd`. */
  completingEnvironment?: string,
): string[] => {
  const participating = new Set(session.expectedEnvironments ?? [])
  for (const environment of session.participatingEnvironments) participating.add(environment)
  return [...participating].filter((name) => name !== completingEnvironment && !session.completedEnvironments.has(name))
}
