/** @type {import('next').NextConfig} */
const config = {
  async rewrites() {
    return [
      {
        source: '/docs/:path*.mdx',
        destination: '/llms.txt/:path*.mdx',
      },
    ]
  },
  async redirects() {
    return [
      {
        source: '/',
        destination: '/docs/overview/getting-started',
        permanent: false,
      },
      {
        source: '/(docs|docs/getting-started)',
        destination: '/docs/overview/getting-started',
        permanent: true,
      },
      {
        source: '/docs/overview/llms-txt',
        destination: '/docs/ai/llms-txt',
        permanent: true,
      },
    ]
  },
  reactStrictMode: true,
}

export default config
