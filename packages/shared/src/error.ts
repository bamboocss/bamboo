export type BambooErrorCode =
  | 'CONFIG_NOT_FOUND'
  | 'CONFIG_ERROR'
  | 'NOT_FOUND'
  | 'CONDITION'
  | 'INVALID_LAYER'
  | 'UNKNOWN_RECIPE'
  | 'INVALID_RECIPE'
  | 'UNKNOWN_TYPE'
  | 'UNKNOWN_ARTIFACT'
  | 'UNKNOWN_LITERAL_TYPE'
  | 'UNKNOWN_RESULT_TYPE'
  | 'MISSING_PARAMS'
  | 'NO_CONTEXT'
  | 'INVALID_TOKEN'
  | 'INVALID_STYLE_VALUE'
  | 'INVALID_STYLE_ARGUMENT'
  | 'NAMING_DISAGREEMENT'
  | 'TOKEN_REFERENCE_UNRESOLVED'
  | 'EXTRACT_FAILED'
  | 'DEAD_IMPORT'
  | 'UNRESOLVED_TOKEN'
  | 'STRICT_VALUES'

export class BambooError extends Error {
  readonly code: string
  readonly hint?: string

  constructor(code: BambooErrorCode, message: string, opts?: { hint?: string; cause?: unknown }) {
    super(message, { cause: opts?.cause })
    this.code = `ERR_BAMBOO_${code}`
    this.hint = opts?.hint
  }
}
