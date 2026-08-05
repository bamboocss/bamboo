import { notFound } from 'next/navigation'
import { docs } from '.velite'

interface RouteContext {
  params: Promise<{ slug: string[] }>
}

export const dynamic = 'force-static'

export async function generateStaticParams() {
  const categories = [
    'overview',
    'installation',
    'concepts',
    'theming',
    'utilities',
    'customization',
    'guides',
    'migration',
    'references',
  ]

  // Category summaries carry a .txt suffix so the file can sit beside the
  // directory of the same name that holds that category's docs --
  // `out/llms.txt/concepts.txt` next to `out/llms.txt/concepts/`. A bare
  // `concepts` file cannot, and static export fails on the collision rather
  // than skipping it. `_redirects` keeps the extensionless URL working.
  const categoryParams = categories.map((category) => ({
    slug: [`${category}.txt`],
  }))

  // Generate params for individual doc pages. Each doc is emitted twice: once
  // bare, and once with the .mdx suffix the GET handler already strips. Under
  // `output: 'export'` a path only exists if it is listed here, and the .mdx
  // form is what `/docs/<path>.mdx` redirects to for agents fetching raw
  // markdown -- a redirect to an unlisted path would 404.
  const docParams = docs.flatMap((doc) => {
    const slugParts = doc.slug.replace('docs/', '').split('/')
    const lastPart = slugParts[slugParts.length - 1]

    return [{ slug: slugParts }, { slug: [...slugParts.slice(0, -1), `${lastPart}.mdx`] }]
  })

  return [...categoryParams, ...docParams]
}

export async function GET(request: Request, context: RouteContext) {
  const params = await context.params
  let slugParts = params.slug

  // Strip the extension the URL carries: .mdx for the /docs raw-markdown alias,
  // .txt for category summaries.
  const lastPart = slugParts[slugParts.length - 1]
  const extension = ['.mdx', '.txt'].find((ext) => lastPart.endsWith(ext))
  if (extension) {
    slugParts = [...slugParts.slice(0, -1), lastPart.slice(0, -extension.length)]
  }

  // Check if this is a specific doc request (e.g., /installation/redwood)
  if (slugParts.length > 1) {
    const fullSlug = `docs/${slugParts.join('/')}`
    const doc = docs.find((d) => d.slug === fullSlug)

    if (!doc) {
      notFound()
    }

    // Generate content for a single doc
    const content = generateSingleDocContent(doc)

    return new Response(content, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  // Category level request (e.g., /installation)
  const category = slugParts[0]

  // Filter docs by category
  const categoryDocs = docs.filter((doc) => doc.slug.startsWith(`docs/${category}`))

  if (categoryDocs.length === 0) {
    notFound()
  }

  // Sort docs by slug for consistent ordering
  const sortedDocs = categoryDocs.sort((a, b) => a.slug.localeCompare(b.slug))

  // Build the content
  const content = generateCategoryContent(category, sortedDocs)

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

function generateSingleDocContent(doc: (typeof import('.velite').docs)[0]) {
  return `# ${doc.title}

${doc.description || ''}

${doc.llm}

---

_This content is automatically generated from the official Bamboo CSS documentation._
`
}

function generateCategoryContent(category: string, docs: typeof import('.velite').docs) {
  const categoryTitles: Record<string, string> = {
    overview: 'Bamboo CSS Overview',
    installation: 'Bamboo CSS Installation Guides',
    concepts: 'Bamboo CSS Core Concepts',
    theming: 'Bamboo CSS Theming',
    utilities: 'Bamboo CSS Utilities',
    customization: 'Bamboo CSS Customization',
    guides: 'Bamboo CSS Guides',
    migration: 'Bamboo CSS Migration Guides',
    references: 'Bamboo CSS References',
  }

  const sections = docs
    .map((doc) => {
      const title = doc.title
      const slug = doc.slug.replace('docs/', '')
      const level = slug.split('/').length - 1
      const headerLevel = '#'.repeat(Math.min(level + 1, 6))

      return `
${headerLevel} ${title}

${doc.description || ''}

${doc.llm}
`
    })
    .join('\n\n---\n\n')

  return `# ${categoryTitles[category] || category}

> This document contains all ${category} documentation for Bamboo CSS

## Table of Contents

${docs.map((doc) => `- [${doc.title}](#${doc.title.toLowerCase().replace(/\s+/g, '-')})`).join('\n')}

---

${sections}

---

_This content is automatically generated from the official Bamboo CSS documentation._
`
}
