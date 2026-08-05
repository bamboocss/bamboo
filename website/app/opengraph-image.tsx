import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og/render'

export const alt = 'Bamboo CSS'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

// Metadata image routes are treated as dynamic unless told otherwise, and
// `output: 'export'` rejects a dynamic route outright rather than prerendering it.
export const dynamic = 'force-static'

export default function Image() {
  return renderOgImage({})
}
