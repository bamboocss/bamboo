declare module 'virtual:*' {
  export const config: import('@bamboocss/types').UserConfig
  export const textStyles: Record<string, string>
  export const layerStyles: Record<string, string>
  export const themes: Record<string, any>
}
