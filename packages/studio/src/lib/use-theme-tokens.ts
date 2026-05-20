import { useMemo } from 'react'
import { useStore } from '@nanostores/react'
import type { TokenDataTypes } from '@bamboocss/types'
import * as context from './bamboo-context'
import { currentThemeStore } from './theme-store'

export const useThemeTokens = (category: keyof TokenDataTypes) => {
  const theme = useStore(currentThemeStore)

  const tokens = useMemo(() => {
    return context.getThemeRelevantTokens(category, theme)
  }, [category, theme])

  return tokens
}
