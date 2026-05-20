const configName = 'bamboo'

const bambooConfigFiles = new Set([
  `${configName}.config.ts`,
  `${configName}.config.js`,
  `${configName}.config.mts`,
  `${configName}.config.mjs`,
  `${configName}.config.cts`,
  `${configName}.config.cjs`,
])

export const isBambooConfig = (file: string) => bambooConfigFiles.has(file)
