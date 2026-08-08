import type { CssOptions, Stylesheet } from '@bamboocss/core'
import { BambooError } from '@bamboocss/shared'
import type {
  AtomicRecipeRule,
  AtomicRule,
  RecipeDefinition,
  RecipeVariantsRule,
  SlotRecipeDefinition,
  SystemStyleObject,
} from '@bamboocss/types'
import type { Context } from './context'
import type { StyleDecoder } from './style-decoder'
import type { StyleEncoder } from './style-encoder'

export class RuleProcessor {
  encoder: StyleEncoder
  decoder: StyleDecoder
  sheet: Stylesheet

  constructor(private context: Context) {
    this.encoder = context.encoder
    this.decoder = context.decoder
    this.sheet = context.createSheet()
  }

  getParamsOrThrow() {
    const isReady = Boolean(this.encoder && this.decoder && this.sheet)
    if (!isReady) {
      throw new BambooError('MISSING_PARAMS', 'RuleProcessor is missing params, please call `clone` first')
    }

    return {
      encoder: this.encoder,
      decoder: this.decoder,
      sheet: this.sheet,
    }
  }

  clone() {
    this.encoder = this.context.encoder.clone()
    this.decoder = this.context.decoder.clone()
    this.sheet = this.context.createSheet()

    return this
  }

  toCss(options?: CssOptions) {
    const { decoder, sheet } = this.getParamsOrThrow()

    sheet.processDecoder(decoder)
    return sheet.toCss(options)
  }

  css(styles: SystemStyleObject): AtomicRule {
    const { encoder, decoder } = this.getParamsOrThrow()

    const scope = encoder.withScope(() => encoder.processAtomic(styles))
    decoder.collect(encoder)

    return {
      styles,
      getClassNames: () => decoder.filterClassNames(scope),
      toCss: this.toCss.bind(this),
    }
  }

  cva(recipeConfig: RecipeDefinition<any>): AtomicRecipeRule {
    const { encoder, decoder } = this.getParamsOrThrow()

    const scope = encoder.withScope(() => encoder.processAtomicRecipe(recipeConfig))
    decoder.collect(encoder)

    return {
      config: recipeConfig,
      getClassNames: () => decoder.filterClassNames(scope),
      toCss: this.toCss.bind(this),
    }
  }

  sva(recipeConfig: SlotRecipeDefinition<string, any>): AtomicRecipeRule {
    const { encoder, decoder } = this
    this.getParamsOrThrow()

    const scope = encoder.withScope(() => encoder.processAtomicSlotRecipe(recipeConfig))
    decoder.collect(encoder)

    return {
      config: recipeConfig,
      getClassNames: () => decoder.filterClassNames(scope),
      toCss: this.toCss.bind(this),
    }
  }

  recipe(name: string, variants: Record<string, any> = {}): RecipeVariantsRule | undefined {
    const { encoder, decoder } = this
    this.getParamsOrThrow()

    const scope = encoder.withScope(() => encoder.processRecipe(name, variants))
    decoder.collect(encoder)

    return {
      variants,
      getClassNames: () => decoder.filterClassNames(scope),
      toCss: this.toCss.bind(this),
    }
  }
}
