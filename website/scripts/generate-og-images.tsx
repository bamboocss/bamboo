/**
 * Renders one Open Graph card per doc into `public/og`, mirroring the doc's own path
 * so `docs/ai/mcp-server` becomes `/og/ai/mcp-server.png`.
 *
 * This exists instead of an `opengraph-image.tsx` beside the page because that file
 * cannot live inside a catch-all segment: `/docs/[...slug]/opengraph-image` is
 * ambiguous -- Next cannot tell a request for the image from a doc whose slug is
 * literally `opengraph-image` -- and its dev server refuses to build the route table
 * at all, taking `next dev` down with it. Production hid the problem, because
 * generateStaticParams prerenders concrete paths and never asks the router to
 * disambiguate. See https://github.com/vercel/next.js/issues/49630, open since 2023.
 *
 * Runs after velite (it reads the collection) and before `next build` (it writes into
 * public/), which is why the build script names its steps rather than globbing them.
 */
import { docs } from '../.velite/index.js'
import { renderOgImage } from '../src/lib/og/render'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = path.join(process.cwd(), 'public', 'og')

const main = async () => {
  // Rebuilt from scratch so a renamed or deleted doc cannot leave a stale card behind
  // for a URL that no longer resolves.
  await rm(OUT_DIR, { force: true, recursive: true })

  for (const doc of docs) {
    const relative = doc.slug.replace(/^docs\//, '')
    const file = path.join(OUT_DIR, `${relative}.png`)

    const image = await renderOgImage({
      category: 'Docs',
      description: doc.description,
      title: doc.title,
    })

    await mkdir(path.dirname(file), { recursive: true })
    await writeFile(file, Buffer.from(await image.arrayBuffer()))
  }

  console.log(`🎋 info [og] rendered ${docs.length} cards to public/og`)
}

// Not top-level await: the website package is CJS, and a build step that swallowed a
// failure would ship pages whose og:image 404s.
main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
