/* eslint-disable */
// @ts-nocheck
import type * as Bamboo from '@bamboocss/dev'
import type { RecipeVariantRecord, RecipeConfig, SlotRecipeVariantRecord, SlotRecipeConfig } from './recipe';
import type { Parts } from './parts';
import type { PatternConfig, PatternProperties } from './pattern';
import type { GlobalStyleObject, SystemStyleObject } from './system-types';
import type { CompositionStyles } from './composition';

declare module '@bamboocss/dev' {
  export function defineRecipe<V extends RecipeVariantRecord>(config: RecipeConfig<V>): Bamboo.RecipeConfig
  export function defineSlotRecipe<S extends string, V extends SlotRecipeVariantRecord<S>>(config: SlotRecipeConfig<S, V>): Bamboo.SlotRecipeConfig
  export function defineStyles(definition: SystemStyleObject): SystemStyleObject
  export function defineGlobalStyles(definition: GlobalStyleObject): Bamboo.GlobalStyleObject
  export function defineTextStyles(definition: CompositionStyles['textStyles']): Bamboo.TextStyles
  export function defineAnimationStyles(definition: CompositionStyles['animationStyles']): Bamboo.AnimationStyles
  export function defineLayerStyles(definition: CompositionStyles['layerStyles']): Bamboo.LayerStyles
  export function definePattern<T extends PatternProperties>(config: PatternConfig<T>): Bamboo.PatternConfig
  export function defineParts<T extends Parts>(parts: T): (config: Partial<Record<keyof T, SystemStyleObject>>) => Partial<Record<keyof T, SystemStyleObject>>
}