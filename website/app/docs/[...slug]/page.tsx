import { docs } from '.velite'
import { Breadcrumb } from '@/components/docs/breadcrumb'
import { Header } from '@/components/docs/header'
import { MDXContent } from '@/components/docs/mdx-content'
import { Pagination } from '@/components/docs/pagination'
import { Sidebar } from '@/components/docs/sidebar'
import { Toc } from '@/components/ui/toc'
import { css, cx } from '@/styled-system/css'
import { notFound } from 'next/navigation'

interface DocsPageProps {
  params: Promise<{
    slug: string[]
  }>
}

export async function generateStaticParams() {
  return docs.map((doc) => ({ slug: doc.slug.split('/').slice(1) }))
}

export async function generateMetadata({ params }: DocsPageProps) {
  const { slug } = await params
  const doc = docs.find((doc) => doc.slug.endsWith(slug.join('/')))

  if (!doc) {
    return {
      title: 'Bamboo CSS',
      description:
        'Build-time, type-safe, zero-runtime CSS-in-JS. Prune unused tokens, tree-shake the runtime, and fold static styles into plain class strings.',
    }
  }

  // Written by scripts/generate-og-images.tsx, which mirrors the doc's path. An
  // `opengraph-image.tsx` beside this file would be the idiomatic way to do it, but it
  // cannot live inside a catch-all -- it takes `next dev` down entirely. See the
  // script for the detail. Resolved against metadataBase in seo.config.ts.
  const ogImage = `/og/${doc.slug.replace(/^docs\//, '')}.png`

  return {
    title: `${doc.title} | Bamboo CSS`,
    description: doc.description,
    openGraph: {
      title: doc.title,
      description: doc.description,
      type: 'article',
      images: [ogImage],
    },
    twitter: {
      card: 'summary_large_image',
      title: doc.title,
      description: doc.description,
      images: [ogImage],
    },
  }
}

export default async function DocsPage(props: DocsPageProps) {
  const params = await props.params

  const slug = params.slug.join('/')
  const doc = docs.find((doc) => doc.slug.endsWith(slug))

  if (!doc) {
    notFound()
  }

  // All three columns start at --content-top. The sticky ones set it directly; the
  // article gets there from the layout's navbar padding plus its own. Nothing here
  // adds a private offset on top, which is what used to make them drift.
  return (
    // Same width and the same inset as the navbar's inner wrapper (see the `nav` part
    // in theme/recipes/navbar.recipe.ts), so the sidebar starts on the same vertical
    // as the logo above it. Matching maxW alone is not enough -- the navbar also pads.
    <div
      className={css({
        maxW: '90rem',
        mx: 'auto',
        ps: 'max(env(safe-area-inset-left), 1.5rem)',
        pe: 'max(env(safe-area-inset-right), 1.5rem)',
        display: 'flex',
        position: 'relative',
      })}
    >
      <aside
        // No inset on the leading edge: the section labels have to start on the same
        // vertical as the logo above them, and any padding here shifts them right of it.
        // Nothing on top either -- that would drop the first link below the breadcrumb.
        // Not decorative -- Toc resolves its scroll container with closest('.scroll-area').
        className={cx(
          css({
            display: { base: 'none', lg: 'block' },
            flexShrink: '0',
            w: '64',
            position: 'sticky',
            top: 'var(--content-top)',
            height: 'calc(100vh - var(--content-top))',
            overflowY: 'auto',
            pe: '4',
            pb: '4',
          }),
          'scroll-area',
        )}
      >
        <Sidebar slug={slug} />
      </aside>

      <article className={css({ flex: '1', minW: '0', px: { base: '4', lg: '10' }, pt: '8' })}>
        <Breadcrumb slug={slug} />
        <Header doc={doc} />
        <MDXContent code={doc.code} />
        <Pagination slug={slug} />
      </article>

      <div
        className={cx(
          css({
            visibility: doc.hideToc ? 'hidden' : 'visible',
            display: { base: 'none', xl: 'block' },
            flexShrink: '0',
            w: '56',
            position: 'sticky',
            top: 'var(--content-top)',
            maxH: 'calc(100vh - var(--content-top))',
            overflowY: 'auto',
          }),
          'scroll-area',
        )}
      >
        <Toc data={doc.toc} />
      </div>
    </div>
  )
}
