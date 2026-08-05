import { getPublicUrl } from '@/lib/public-url'
import type { Metadata } from 'next'

const defineMetadata = <T extends Metadata>(metadata: T) => metadata

const publicUrl = getPublicUrl()

const seoConfig = defineMetadata({
  metadataBase: new URL(publicUrl),
  title: {
    template: '%s - Bamboo CSS',
    default: 'Bamboo CSS - Build-time, type-safe, zero-runtime CSS-in-JS',
  },
  description:
    'Build-time, type-safe, zero-runtime CSS-in-JS. Prune unused tokens, tree-shake the runtime, and fold static styles into plain class strings.',
  themeColor: '#F6E458',
  // The default card comes from app/opengraph-image.tsx; per-doc cards come from
  // app/docs/[...slug]/opengraph-image.tsx. Both are rendered at build time.
  openGraph: {
    url: publicUrl,
  },
  manifest: '/site.webmanifest',
  icons: [
    { rel: 'icon', url: '/favicon.ico' },
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' },
    { rel: 'mask-icon', url: '/favicon.ico' },
    { rel: 'image/x-icon', url: '/favicon.ico' },
  ],
})

export default seoConfig
