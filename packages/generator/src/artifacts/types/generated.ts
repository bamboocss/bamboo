import type { Context } from '@bamboocss/core'
import composition from '../generated/composition.d.ts.json' with { type: 'json' }
import csstype from '../generated/csstype.d.ts.json' with { type: 'json' }
import pattern from '../generated/pattern.d.ts.json' with { type: 'json' }
import recipe from '../generated/recipe.d.ts.json' with { type: 'json' }
import selectors from '../generated/selectors.d.ts.json' with { type: 'json' }
import staticCss from '../generated/static-css.d.ts.json' with { type: 'json' }
import system from '../generated/system-types.d.ts.json' with { type: 'json' }

export function getGeneratedTypes(ctx: Context) {
  return {
    cssType: csstype.content,
    static: staticCss.content,
    recipe: ctx.file.rewriteTypeImport(recipe.content),
    pattern: ctx.file.rewriteTypeImport(pattern.content.replace('../tokens', '../tokens/index')),
    composition: ctx.file.rewriteTypeImport(composition.content),
    selectors: ctx.file.rewriteTypeImport(selectors.content),
  }
}

export function getGeneratedSystemTypes(ctx: Context) {
  return {
    system: ctx.file.rewriteTypeImport(system.content),
  }
}
