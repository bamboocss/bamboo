export const physicalProperties: Record<string, string> = {
  borderBottom: 'borderBlockEnd',
  borderBottomColor: 'borderBlockEndColor',
  borderBottomLeftRadius: 'borderEndStartRadius',
  borderBottomRightRadius: 'borderEndEndRadius',
  borderBottomStyle: 'borderBlockEndStyle',
  borderBottomWidth: 'borderBlockEndWidth',
  borderLeft: 'borderInlineStart',
  borderLeftColor: 'borderInlineStartColor',
  borderLeftStyle: 'borderInlineStartStyle',
  borderLeftWidth: 'borderInlineStartWidth',
  borderRight: 'borderInlineEnd',
  borderRightColor: 'borderInlineEndColor',
  borderRightStyle: 'borderInlineEndStyle',
  borderRightWidth: 'borderInlineEndWidth',
  borderTop: 'borderBlockStart',
  borderTopColor: 'borderBlockStartColor',
  borderTopLeftRadius: 'borderStartStartRadius',
  borderTopRightRadius: 'borderStartEndRadius',
  borderTopStyle: 'borderBlockStartStyle',
  borderTopWidth: 'borderBlockStartWidth',
  bottom: 'insetBlockEnd',
  left: 'insetInlineStart',
  marginBottom: 'marginBlockEnd',
  marginLeft: 'marginInlineStart',
  marginRight: 'marginInlineEnd',
  marginTop: 'marginBlockStart',
  paddingBottom: 'paddingBlockEnd',
  paddingLeft: 'paddingInlineStart',
  paddingRight: 'paddingInlineEnd',
  paddingTop: 'paddingBlockStart',
  right: 'insetInlineEnd',
  top: 'insetBlockStart',
}

// Map of property names to their physical values and corresponding logical values
export const physicalPropertyValues: Record<string, Record<string, string>> = {
  // text-align physical values mapped to logical values
  textAlign: {
    left: 'start',
    right: 'end',
  },
}
