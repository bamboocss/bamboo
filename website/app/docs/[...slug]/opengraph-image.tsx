import { docs } from '.velite'
import { OG_CONTENT_TYPE, OG_SIZE, renderOgImage } from '@/lib/og/render'

export const alt = 'Bamboo CSS documentation'
export const size = OG_SIZE
export const contentType = OG_CONTENT_TYPE

// Metadata image routes are treated as dynamic unless told otherwise, and
// `output: 'export'` rejects a dynamic route outright rather than prerendering it.
export const dynamic = 'force-static'

// The image set is bounded by the docs collection, so every card is rendered
// once at build time and served as a file. This is what the `/og` route handler
// used to do per request.
export function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug.split('/').slice(1) }))
}

// `params` is a plain object on Next 15 and a promise on Next 16; awaiting is
// correct on both.
interface ImageProps {
  params: Promise<{ slug: string[] }> | { slug: string[] }
}

export default async function Image(props: ImageProps) {
  const { slug } = await props.params
  const doc = docs.find((doc) => doc.slug.endsWith(slug.join('/')))

  return renderOgImage({
    title: doc?.title,
    description: doc?.description,
    category: 'Docs',
  })
}
