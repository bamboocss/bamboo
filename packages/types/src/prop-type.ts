import type { ConditionalValue } from './conditions'
import type { CssProperties } from './system-types'

/* -----------------------------------------------------------------------------
 * Shadowed export (in CLI): DO NOT REMOVE
 * -----------------------------------------------------------------------------*/

/**
 * Empty on purpose, and unreferenced on purpose. A generated project never sees this file:
 * the CLI emits its own `styled-system/types/prop-type.d.ts` declaring `UtilityValues` and a
 * `PropertyValue` resolved against it. This copy is what ships in the `@bamboocss/types`
 * bundle, so nothing in this repo can consume it and knip cannot tell it apart from dead code.
 *
 * @public
 */
export interface PropertyTypes {}

export type PropertyValue<K extends string> = K extends keyof PropertyTypes
  ? ConditionalValue<PropertyTypes[K]>
  : K extends keyof CssProperties
    ? ConditionalValue<CssProperties[K]>
    : never
