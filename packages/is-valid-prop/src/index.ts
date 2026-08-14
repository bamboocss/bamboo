/**
 * Static CSS reference data, for the build.
 *
 * Two generated modules beside this one, from two sources and on two cadences:
 *
 * - `properties.ts` — which names are CSS properties at all, from mdn-data. `pnpm mdn`.
 * - `values.ts` — what each of them accepts, from csstype's unions and mdn's grammar.
 *   `pnpm values`.
 *
 * Kept apart because they were briefly one file, and generating either then rewrote the other:
 * a keyword-table change swept up whatever `mdn-data` had shifted since the last run, in a
 * commit about something else.
 */
export { allCssProperties, isCssProperty } from './properties'
export { acceptsAuthorIdent, cssGlobalKeywords, cssPropertyKeywords } from './values'
