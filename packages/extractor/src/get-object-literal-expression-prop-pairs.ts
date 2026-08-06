import type { ObjectLiteralExpression } from 'ts-morph'
import { Node } from 'ts-morph'
import { box } from './box'
import { BoxNodeConditional, type BoxNode, type BoxNodeMap } from './box-factory'
import { getPropertyName } from './get-property-name'
import { maybeBoxNode } from './maybe-box-node'
import type { BoxContext, MatchFnPropArgs } from './types'
import { isNullish, unwrapExpression } from './utils'

export const getObjectLiteralExpressionPropPairs = (
  expression: ObjectLiteralExpression,
  expressionStack: Node[],
  ctx: BoxContext,
  matchProp?: (prop: MatchFnPropArgs) => boolean,
) => {
  const properties = expression.getProperties()

  if (properties.length === 0) {
    return box.emptyObject(expression, expressionStack)
  }

  const extractedPropValues = [] as Array<[string, BoxNode]>
  const spreadConditions = [] as BoxNodeConditional[]
  /** Spreads the extractor walked structurally — see `BoxNodeMap.resolvedSpreads`. */
  const resolvedSpreads = [] as Array<{ node: Node; box: BoxNodeMap }>

  properties.forEach((property) => {
    const stack = [...expressionStack]

    stack.push(property)

    if (
      Node.isPropertyAssignment(property) ||
      Node.isShorthandPropertyAssignment(property) ||
      Node.isGetAccessorDeclaration(property)
    ) {
      const propNameBox = getPropertyName(property, stack, ctx)
      if (!propNameBox) return

      const propName = propNameBox.value

      if (isNullish(propName)) return

      if (matchProp && !matchProp?.({ propName: propName as string, propNode: property })) {
        return
      }

      if (Node.isShorthandPropertyAssignment(property)) {
        const initializer = property.getNameNode()
        stack.push(initializer)

        const maybeValue = maybeBoxNode(initializer, stack, ctx)
        if (maybeValue) {
          extractedPropValues.push([propName.toString(), maybeValue])
          return
        }
      }

      let init: Node | undefined
      if (Node.isGetAccessorDeclaration(property)) {
        const body = property.getBody()
        init = Node.isBlock(body) ? body.getStatements().at(-1) : undefined
      } else {
        init = property.getInitializer()
      }
      if (!init) return

      const returnExpression = Node.isReturnStatement(init) ? init.getExpression() : undefined
      const initializer = unwrapExpression(returnExpression ?? init)
      stack.push(initializer)

      const maybeValue = maybeBoxNode(initializer, stack, ctx)

      if (maybeValue) {
        extractedPropValues.push([propName.toString(), maybeValue])
        return
      }
    }

    if (Node.isSpreadAssignment(property)) {
      const initializer = unwrapExpression(property.getExpression())
      stack.push(initializer)

      const maybeObject = maybeBoxNode(initializer, stack, ctx, matchProp)

      // Nothing came back at all, so whatever this spread contributes is unknown. It stays
      // off `resolvedSpreads`, which is what tells a consumer not to trust it.
      if (!maybeObject) return

      // An *evaluated* spread — the extractor ran the expression and got a plain value back.
      // Its keys are re-boxed against the spread site, so whatever file they came from is no
      // longer recoverable from the tree. Left off `resolvedSpreads` for that reason: a
      // consumer folding this would produce a literal depending on a module it cannot name,
      // and so cannot watch.
      if (box.isObject(maybeObject)) {
        Object.entries(maybeObject.value).forEach(([propName, value]) => {
          const boxNode = box.from(value, initializer, stack)
          if (!boxNode) return
          extractedPropValues.push([propName, boxNode])
        })
        return
      }

      // A spread the extractor walked structurally. The nested boxes keep their own nodes,
      // so every key stays traceable to the file it was written in.
      //
      // Recorded with the map itself, not just the node. Being walked is not the same as
      // every key having survived — the extractor omits what it cannot evaluate at any
      // depth, and once flattened into `orderedMapValue` there is no way back to what was
      // dropped. A consumer that needs to know has to be handed the map to check.
      if (box.isMap(maybeObject)) {
        maybeObject.value.forEach((nested, propName) => {
          extractedPropValues.push([propName, nested])
        })
        resolvedSpreads.push({ node: initializer, box: maybeObject })
        return
      }

      if (box.isConditional(maybeObject)) {
        spreadConditions.push(maybeObject)
      }
    }
  })

  // preserves order of insertion, useful for spread operator to override props
  const orderedMapValue = new Map()

  extractedPropValues.forEach(([propName, value]) => {
    if (orderedMapValue.has(propName)) {
      orderedMapValue.delete(propName)
    }
    orderedMapValue.set(propName, value)
  })

  const map = box.map(orderedMapValue, expression, expressionStack)

  if (resolvedSpreads.length > 0) {
    map.resolvedSpreads = resolvedSpreads
  }

  if (spreadConditions.length > 0) {
    map.spreadConditions = spreadConditions
  }

  return map
}
