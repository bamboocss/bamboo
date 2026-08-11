import { isObject, walkObject } from '@bamboocss/shared'
import type { MixinSpec } from '@bamboocss/types'

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

export function generateMixinsSpec(theme: Record<string, any> | undefined): MixinSpec {
  const styles = collectCompositionStyles(theme?.['mixins'] ?? {})

  const data = styles.map((style) => ({
    name: style.name,
    description: style.description,
    functionExamples: [`css({ ${formatProps({ mixin: style.name })} })`],
  }))

  return { type: 'mixins', data }
}
