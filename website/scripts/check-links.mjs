/**
 * Validates every internal `/docs/...` link in the content tree.
 *
 * This replaces `mdx-local-link-checker`, which could not do the job: it resolves a
 * root-relative href against the repository root rather than the site root, so it called
 * every `/docs/...` link in the tree broken. The script it backed had also been pointed at
 * `docs` and `website/pages/docs` since before the content moved to `website/content/docs`,
 * so it exited on ENOENT without checking anything, and 36 dead links accumulated behind it
 * -- including one anchor repeated across all 18 framework installation guides.
 *
 * Anchors are resolved the way `rehype-slug` does, via github-slugger's rules: lowercase,
 * drop punctuation, spaces to hyphens. Note it does *not* trim, so a heading written
 * `## Should I use atomic or config recipes ?` slugifies with a trailing hyphen. Getting that
 * wrong reports working links as broken.
 *
 * External links are deliberately not checked -- that needs the network and fails on
 * someone else's outage rather than on our mistake.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const ROOT = new URL('../content/docs', import.meta.url).pathname

const walk = (dir) =>
  readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : full.endsWith('.mdx') ? [full] : []
  })

/** github-slugger, as `rehype-slug` applies it. No trim: trailing spaces become hyphens. */
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/ /g, '-')

const headingsOf = (source) => {
  const anchors = new Set()
  let fenced = false

  for (const line of source.split('\n')) {
    if (line.trimStart().startsWith('```')) {
      fenced = !fenced
      continue
    }
    if (fenced) continue

    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (!heading) continue

    // Strip the inline markup rehype has already resolved by the time it slugifies.
    const text = heading[1].replace(/`|\*\*/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    anchors.add(slugify(text.trim()))
    anchors.add(slugify(text))
  }

  return anchors
}

const files = walk(ROOT)
const pages = new Map(
  files.map((file) => [relative(ROOT, file).replace(/\.mdx$/, ''), headingsOf(readFileSync(file, 'utf8'))]),
)

const failures = []

for (const file of files) {
  const from = relative(ROOT, file).replace(/\.mdx$/, '')

  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, index) => {
      const links = [...line.matchAll(/\]\((\/docs\/[^)\s]+)\)/g), ...line.matchAll(/href="(\/docs\/[^"]+)"/g)].map(
        (match) => match[1],
      )

      // Same-page links, which name no page at all: `[below](#cx-joins-in-both-tools)`.
      // These were not checked at all until a stale one — left behind by a renamed heading
      // — shipped in the migration guide and was found by a reader rather than by this.
      const fragments = [...line.matchAll(/\]\(#([^)\s]+)\)/g), ...line.matchAll(/href="#([^"]+)"/g)].map(
        (match) => match[1],
      )

      for (const link of links) {
        const [path, anchor] = link.slice('/docs/'.length).split('#')
        const target = path.replace(/\/$/, '')

        // `/docs/<path>.mdx` is the raw-markdown alias for agents, redirected to
        // `/llms/<path>.mdx` by `public/_redirects`. It names a real page, so resolve it
        // against the same map with the extension removed rather than skipping it --
        // otherwise a typo in one of these goes unchecked.
        if (target.endsWith('.mdx')) {
          const aliased = target.slice(0, -'.mdx'.length)
          if (!pages.has(aliased)) failures.push({ from, line: index + 1, link, why: 'no such page' })
          continue
        }

        if (!pages.has(target)) {
          failures.push({ from, line: index + 1, link, why: 'no such page' })
        } else if (anchor && !pages.get(target).has(anchor)) {
          failures.push({ from, line: index + 1, link, why: 'no such heading' })
        }
      }

      for (const anchor of fragments) {
        if (pages.get(from).has(anchor)) continue
        failures.push({ from, line: index + 1, link: `#${anchor}`, why: 'no such heading on this page' })
      }
    })
}

if (failures.length === 0) {
  console.log(`✓ ${files.length} pages, no broken internal links`)
  process.exit(0)
}

console.error(`✗ ${failures.length} broken internal link(s):\n`)
for (const { from, line, link, why } of failures) {
  console.error(`  ${from}.mdx:${line}  ${link}  (${why})`)
}
process.exit(1)
