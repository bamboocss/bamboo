import type { Metadata } from 'next'

const defineMetadata = <T extends Metadata>(metadata: T) => metadata

const seoConfig = defineMetadata({
  metadataBase: new URL('https://play.bamboo-css.com'),
  title: {
    template: '%s - Bamboo Playground',
    default: 'Bamboo Playground',
  },
  description: 'Explore Bamboo CSS with an interactive playground. Create and share your own Bamboo CSS snippets.',
  openGraph: {
    images: '/og-image.png',
    url: 'https://play.bamboo-css.com',
  },
  manifest: '/site.webmanifest',
  icons: [
    { rel: 'icon', url: '/favicon.ico' },
    { rel: 'apple-touch-icon', url: '/apple-touch-icon.png' },
    { rel: 'mask-icon', url: '/favicon.ico' },
    { rel: 'image/x-icon', url: '/favicon.ico' },
  ],
  twitter: {
    site: '@bamboo__css',
    creator: '@thesegunadebayo',
  },
})

export default seoConfig
