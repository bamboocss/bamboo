import type { Context } from '@bamboocss/core'
import type { PatternSpec } from '@bamboocss/types'

const getExampleValue = (prop: { type?: string; value?: unknown }): string => {
  if (prop.type === 'enum' && Array.isArray(prop.value) && prop.value.length > 0) {
    return `"${prop.value[0]}"`
  }
  if (prop.type === 'boolean') {
    return 'true'
  }
  if (prop.type === 'number') {
    return '4'
  }
  if (prop.type === 'token') {
    return '"md"'
  }
  return '<value>'
}

export const generatePatternsSpec = (ctx: Context): PatternSpec => {
  const patterns = ctx.patterns.details.map((node) => {
    const patternName = node.baseName

    const properties = Object.entries(node.config.properties ?? {})

    // Generate examples for each property
    const functionExamples: string[] = []

    if (properties.length === 0) {
      // No properties, just show basic usage
      functionExamples.push(`${patternName}()`)
    } else {
      // Generate examples for each property
      properties.forEach(([propName, prop]) => {
        const exampleValue = getExampleValue(prop)
        functionExamples.push(`${patternName}({ ${propName}: ${exampleValue} })`)
      })
    }

    // Get default values if they exist
    const defaultValues = typeof node.config.defaultValues === 'object' ? node.config.defaultValues : {}

    return {
      name: patternName,
      description: node.config.description,
      properties: properties.map(([name, prop]) => ({
        name,
        type: ctx.patterns.getPropertyType(prop),
        description: prop.description,
        defaultValue: defaultValues[name],
      })),
      functionExamples,
      jsxExamples: [],
    }
  })

  return {
    type: 'patterns',
    data: patterns,
  }
}
