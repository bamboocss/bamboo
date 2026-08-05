import { getPublicUrl } from '@/lib/public-url'

export const dynamic = 'force-static'

export const GET = async () => {
  const documentSets = [
    {
      title: 'Complete documentation',
      href: `${getPublicUrl('/llms-full.txt')}`,
      description: 'The complete Bamboo CSS documentation including all concepts, utilities, and guides',
    },
    {
      title: 'Overview',
      href: `${getPublicUrl('/llms/overview.txt')}`,
      description: 'Getting started, browser support, FAQ, and why Bamboo CSS',
    },
    {
      title: 'Installation',
      href: `${getPublicUrl('/llms/installation.txt')}`,
      description: 'Framework-specific installation guides for all supported frameworks',
    },
    {
      title: 'Concepts',
      href: `${getPublicUrl('/llms/concepts.txt')}`,
      description: 'Core concepts including patterns, recipes, conditional styles, and responsive design',
    },
    {
      title: 'Theming',
      href: `${getPublicUrl('/llms/theming.txt')}`,
      description: 'Design tokens, text styles, layer styles, and animation styles',
    },
    {
      title: 'Utilities',
      href: `${getPublicUrl('/llms/utilities.txt')}`,
      description: 'All CSS utilities organized by category',
    },
    {
      title: 'Customization',
      href: `${getPublicUrl('/llms/customization.txt')}`,
      description: 'Customizing theme, utilities, patterns, and presets',
    },
    {
      title: 'Guides',
      href: `${getPublicUrl('/llms/guides.txt')}`,
      description: 'Practical guides for specific use cases',
    },
    {
      title: 'Migration',
      href: `${getPublicUrl('/llms/migration.txt')}`,
      description: 'Guides for migrating from other CSS-in-JS libraries',
    },
    {
      title: 'References',
      href: `${getPublicUrl('/llms/references.txt')}`,
      description: 'CLI commands and configuration reference',
    },
  ]

  const content = TEMPLATE.replace(
    '%DOCUMENT_SETS%',
    documentSets.map((set) => `- [${set.title}](${set.href}): ${set.description}`).join('\n'),
  )

  return new Response(content, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
    },
  })
}

const TEMPLATE = `
# Bamboo CSS Documentation for LLMs

> Bamboo CSS is a build-time, type-safe, zero-runtime CSS-in-JS framework. It prunes unused tokens, tree-shakes the runtime, and folds static styles into plain class strings.

## Documentation Sets

This index provides links to documentation organized by topic. Each link contains the full text content for that section, making it easy for LLMs to understand specific aspects of Bamboo CSS.

%DOCUMENT_SETS%

## Notes

- The complete documentation includes all content from the official documentation
- Category-specific documentation files contain only the content relevant to that topic
- The content is automatically generated from the same source as the official documentation
- All code examples and API references are preserved in their original format
`
