/** @type {import('next').NextConfig} */
const config = {
  // The site is fully prerendered -- `next build` writes `out/`, which is served
  // directly from Cloudflare's asset store with no Worker in front of it.
  //
  // `redirects()` and `rewrites()` are not applied under `output: 'export'`; they
  // live in `public/_redirects` instead, which Cloudflare serves as real 30x.
  output: 'export',
  reactStrictMode: true,
}

export default config
