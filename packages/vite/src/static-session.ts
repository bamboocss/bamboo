import { esc, toHash } from '@bamboocss/shared'

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
  /** Semantic atom name -> compact stable or build-local name. */
  denseClasses: Map<string, string>
  /** Compact name -> semantic atom name, used when the fold reports reachability. */
  semanticClasses: Map<string, string>
  denseClassNames: boolean
  allocateClassString(className: string): string
  markClassUsed(className: string): void
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const denseName = (index: number) => {
  let value = index
  let result = ''
  do {
    result = ALPHABET[value % ALPHABET.length]! + result
    value = Math.floor(value / ALPHABET.length) - 1
  } while (value >= 0)
  // A namespace keeps build-local atom names out of the overwhelmingly common unprefixed
  // author class space while retaining two-character names for the first 52 atoms.
  return `_${result}`
}

export type DenseClassNameMode = boolean | 'stable' | 'local'

export const createStaticCompilationSession = (
  denseClassNames: DenseClassNameMode = true,
): StaticCompilationSession => {
  const mode = denseClassNames === true ? 'stable' : denseClassNames
  const session: StaticCompilationSession = {
    utilityLayer: 'utilities',
    sourcemap: false,
    cssLoaded: false,
    transformedFiles: new Set(),
    extractedFiles: new Set(),
    prunableClasses: new Set(),
    viewTransitionClasses: new Set(),
    usedClasses: new Set(),
    denseClasses: new Map(),
    semanticClasses: new Map(),
    denseClassNames: Boolean(mode),
    allocateClassString(className) {
      if (!mode) return className
      return className
        .split(' ')
        .filter(Boolean)
        .map((semantic) => {
          let dense = session.denseClasses.get(semantic)
          if (!dense) {
            dense = mode === 'local' ? denseName(session.denseClasses.size) : `_${toHash(semantic)}`
            const collision = session.semanticClasses.get(dense)
            if (collision && collision !== semantic) {
              throw new Error(
                `Bamboo compact class collision between ${JSON.stringify(collision)} and ${JSON.stringify(semantic)}. ` +
                  `Disable \`denseClassNames\` for this build.`,
              )
            }
            session.denseClasses.set(semantic, dense)
            session.semanticClasses.set(dense, semantic)
          }
          return dense
        })
        .join(' ')
    },
    markClassUsed(className) {
      // Split, like `allocateClassString` above. A folded call reports one entry per call
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
        const semantic = session.semanticClasses.get(token) ?? token
        // Stored in selector form because the CSS reachability pass reads escaped selectors.
        session.usedClasses.add(esc(semantic))
      }
    },
  }
  return session
}

export const resetStaticCompilationSession = (session: StaticCompilationSession) => {
  session.cssLoaded = false
  session.transformedFiles.clear()
  session.extractedFiles.clear()
  session.prunableClasses.clear()
  session.viewTransitionClasses.clear()
  session.usedClasses.clear()
  session.denseClasses.clear()
  session.semanticClasses.clear()
}
