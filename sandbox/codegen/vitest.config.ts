import { defineConfig } from 'vite'
import { UserConfig } from 'vite'
import { UserConfig as TestUserConfig } from 'vitest'

const typecheck = Boolean(process.env.TYPECHECK)

const options: TestUserConfig = {
  react: {
    test: {
      include: ['**/__tests__/*.{test,spec}.{j,t}s?(x)'],
      environment: 'happy-dom',
      typecheck: {
        enabled: typecheck,
        include: ['**/__tests__/*.{test,spec}.{j,t}s?(x)'],
      },
    },
  },
  'strict-tokens': {
    test: {
      include: ['**/__tests__/scenarios/strict-tokens.{test,spec}.{j,t}s?(x)'],
      typecheck: { enabled: typecheck, include: ['**/__tests__/scenarios/strict-tokens.{test,spec}.{j,t}s?(x)'] },
    },
  },
  'strict-property-values': {
    test: {
      include: ['**/__tests__/scenarios/strict-property-values.{test,spec}.{j,t}s?(x)'],
      typecheck: {
        enabled: typecheck,
        include: ['**/__tests__/scenarios/strict-property-values.{test,spec}.{j,t}s?(x)'],
      },
    },
  },
  strict: {
    test: {
      include: ['**/__tests__/scenarios/strict.{test,spec}.{j,t}s?(x)'],
      typecheck: { enabled: typecheck, include: ['**/__tests__/scenarios/strict.{test,spec}.{j,t}s?(x)'] },
    },
  },
  'format-names': {
    test: {
      environment: 'happy-dom',
      include: ['**/__tests__/scenarios/format-names.{test,spec}.{j,t}s?(x)'],
      typecheck: { enabled: typecheck, include: ['**/__tests__/scenarios/format-names.{test,spec}.{j,t}s?(x)'] },
    },
  },
  grouped: {
    test: {
      environment: 'happy-dom',
      include: ['**/__tests__/scenarios/grouped.{test,spec}.{j,t}s?(x)'],
      // No `typecheck` entry: this scenario asserts the emitted stylesheet against the
      // generated runtime, and reads the sheet with `node:fs`, which the sandbox's tsconfig
      // has no types for. The type-level scenarios are `strict*`.
    },
  },
} as Record<string, UserConfig>

const mode = process.env.MODE ?? 'react'
console.log({ mode })
export default defineConfig(options[mode])
