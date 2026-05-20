import { writeFileSync } from 'fs'
import json from 'mdn-data/css/properties.json'
import { properties as svgProperties } from './svg'
import { execFileSync } from 'child_process'

const dashRegex = /-+(.)/g
function camelCaseProperty(str: string): string {
  return str.replace(dashRegex, (_, p1) => p1.toUpperCase())
}

const omitRegex = /^(?:-moz|-ms|--\*)/

const properties = Object.keys(json)
  .concat(Object.keys(svgProperties))
  .filter((v) => !omitRegex.test(v))
  .map((v) => camelCaseProperty(v))

const run = () => {
  const outputPath = './src/index.ts'
  writeFileSync(
    outputPath,
    `
  const userGeneratedStr = "";
  const userGenerated = userGeneratedStr.split(',');
  const cssPropertiesStr = "${Array.from(new Set(properties)).join(',')}";

  const allCssProperties = cssPropertiesStr.split(',').concat(userGenerated)

  const properties = new Map(allCssProperties.map((prop) => [prop, true]))

  function memo<T>(fn: (value: string) => T): (value: string) => T {
    const cache = Object.create(null)
    return (arg: string) => {
      if (cache[arg] === undefined) cache[arg] = fn(arg)
      return cache[arg]
    }
  }

  const cssPropertySelectorRegex = /&|@/

  const isCssProperty = /* @__PURE__ */ memo((prop: string) => {
    return properties.has(prop) || prop.startsWith('--') || cssPropertySelectorRegex.test(prop)
  })

  export { isCssProperty, allCssProperties }
`,
  )
  try {
    execFileSync('oxfmt', [outputPath], { stdio: 'ignore' })
  } catch {
    // oxfmt not available
  }
}

run()
