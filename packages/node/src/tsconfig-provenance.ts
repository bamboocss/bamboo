export interface TsconfigReferenceProvenance {
  readonly from: string
  readonly path: string
}

/** Parser-owned metadata for `paths` without an explicit `baseUrl`. */
export interface TsconfigImplicitBaseUrlProvenance {
  readonly owner: object
  readonly symbol: symbol
  readonly value: string
}

export interface TsconfigResolutionProvenance {
  readonly direct: boolean
  readonly effectivePath?: string
  readonly implicitBaseUrl?: TsconfigImplicitBaseUrlProvenance
  readonly readPaths: readonly string[]
  readonly references: readonly TsconfigReferenceProvenance[]
  readonly rootPath?: string
  readonly traversalLimitExceeded: boolean
  readonly unresolvedReferences: readonly string[]
}
