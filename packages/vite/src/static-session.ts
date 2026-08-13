import { esc } from '@bamboocss/shared'

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
   * Every environment this run intends to build, when the run says so before building any.
   *
   * `undefined` means nothing announced one, which is the single-environment shape: `vite
   * build` without `builder`, and the `build()` API, each set up exactly one environment.
   * Reachability is complete the moment that one finishes, so pruning goes ahead.
   */
  expectedEnvironments: Set<string> | undefined
  /** Environments whose `buildStart` has run in the build currently in progress. */
  startedEnvironments: Set<string>
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
    startedEnvironments: new Set(),
    prunedClasses: new Set(),
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
 * Environments this run intends to build that have not been compiled yet.
 *
 * Empty means everything the run will contribute has been contributed, which is the condition
 * every whole-run judgement here waits for: pruning the stylesheet against reachability, and
 * the two guards that ask whether the compiled modules and the extraction graph agree. Each of
 * those is false about a build in progress and true only about a finished one.
 *
 * Empty is also the answer for a single-environment build, where nothing announced an
 * environment list because there is only ever one — so that path is unchanged.
 *
 * An environment a run declares and then never builds leaves this permanently non-empty, and
 * those judgements are skipped for the run. Every one of them errs towards shipping more CSS
 * or asserting less, so that is the safe direction to be wrong in.
 */
export const remainingEnvironments = (session: StaticCompilationSession): string[] =>
  [...(session.expectedEnvironments ?? [])].filter((name) => !session.startedEnvironments.has(name))

export const resetStaticCompilationSession = (session: StaticCompilationSession) => {
  session.cssLoaded = false
  session.transformedFiles.clear()
  session.extractedFiles.clear()
  session.prunableClasses.clear()
  session.viewTransitionClasses.clear()
  session.usedClasses.clear()
  session.startedEnvironments.clear()
  session.prunedClasses.clear()
  // `expectedEnvironments` deliberately survives. It describes how the *run* is driven rather
  // than anything a build produced, and a `vite build --watch` rebuild is the same run: the
  // hook that announces it fires once, before the first environment builds, and never again.
}
