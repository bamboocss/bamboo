import { isObject, walkObject } from '@bamboocss/shared'
import type { AnimationStyleSpec, LayerStyleSpec, TextStyleSpec } from '@bamboocss/types'

export const isBooleanValue = (value: string) => value === 'true' || value === 'false'

export const formatFunctionValue = (value: string): string => (isBooleanValue(value) ? value : `'${value}'`)

export const buildFunctionProps = (key: string, value: string) => `${key}: ${formatFunctionValue(value)}`

export interface FormatPropsOptions {
  keyValueSeparator?: string
  propSeparator?: string
  quoteStyle?: 'single' | 'double' | 'none'
}

export const formatProps = (props: Record<string, string | null | undefined>, options: FormatPropsOptions = {}) => {
  const { keyValueSeparator = ': ', propSeparator = ', ', quoteStyle = 'single' } = options
  const quote = quoteStyle === 'single' ? "'" : quoteStyle === 'double' ? '"' : ''
  return Object.entries(props)
    .filter(([_, value]) => value != null)
    .map(([key, value]) => `${key}${keyValueSeparator}${quote}${value}${quote}`)
    .join(propSeparator)
}

const collectCompositionStyles = (values: Record<string, any>): Array<{ name: string; description?: string }> => {
  const result: Array<{ name: string; description?: string }> = []

  walkObject(
    values,
    (token, paths) => {
      if (token && isObject(token) && 'value' in token) {
        const filteredPaths = paths.filter((item) => item !== 'DEFAULT')
        result.push({
          name: filteredPaths.join('.'),
          description: token.description,
        })
      }
    },
    {
      stop: (v) => isObject(v) && 'value' in v,
    },
  )

  return result
}

export type CompositionStyleType = 'text-styles' | 'layer-styles' | 'animation-styles'

const COMPOSITION_STYLE_CONFIG: Record<CompositionStyleType, { prop: string; themeKey: string }> = {
  'text-styles': { prop: 'textStyle', themeKey: 'textStyles' },
  'layer-styles': { prop: 'layerStyle', themeKey: 'layerStyles' },
  'animation-styles': { prop: 'animationStyle', themeKey: 'animationStyles' },
}

type CompositionStyleSpec<T extends CompositionStyleType> = T extends 'text-styles'
  ? TextStyleSpec
  : T extends 'layer-styles'
    ? LayerStyleSpec
    : AnimationStyleSpec

export function generateCompositionStyleSpec<T extends CompositionStyleType>(
  type: T,
  theme: Record<string, any> | undefined,
): CompositionStyleSpec<T> {
  const { prop, themeKey } = COMPOSITION_STYLE_CONFIG[type]
  const styles = collectCompositionStyles(theme?.[themeKey] ?? {})

  const data = styles.map((style) => ({
    name: style.name,
    description: style.description,
    functionExamples: [`css({ ${formatProps({ [prop]: style.name })} })`],
  }))

  return { type, data } as CompositionStyleSpec<T>
}
