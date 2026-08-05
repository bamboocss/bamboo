import { type Docs as Doc } from '.velite'
import Fuse from 'fuse.js'

export interface SearchRecord {
  id: string
  url: string
  title: string
  content: string
  type: 'page' | 'heading'
  pageTitle?: string
  headingLevel?: number
  description?: string
  breadcrumb?: string[]
}

export interface SearchIndex {
  generated: string
  totalRecords: number
  records: SearchRecord[]
}

export interface SearchItem {
  label: string
  value: string
  category: string
  description: string
  content?: string
  type?: 'page' | 'heading'
}

/**
 * Extract content for each heading section from the full document
 */
function extractSectionContent(fullContent: string, toc: Doc['toc'], currentIndex: number): string {
  const currentHeading = toc[currentIndex]
  const nextHeading = toc[currentIndex + 1]

  // Find the start position of current heading in content
  const currentHeadingPattern = new RegExp(`#+\\s*${escapeRegExp(currentHeading.title)}`, 'i')
  const currentMatch = fullContent.match(currentHeadingPattern)

  if (!currentMatch) {
    return ''
  }

  const startIndex = currentMatch.index!

  // Find end position (start of next heading or end of document)
  let endIndex = fullContent.length
  if (nextHeading) {
    const nextHeadingPattern = new RegExp(`#+\\s*${escapeRegExp(nextHeading.title)}`, 'i')
    const nextMatch = fullContent.slice(startIndex + currentMatch[0].length).match(nextHeadingPattern)
    if (nextMatch) {
      endIndex = startIndex + currentMatch[0].length + nextMatch.index!
    }
  }

  // Extract and clean the content
  const content = fullContent
    .slice(startIndex, endIndex)
    .replace(/```[\s\S]*?```/g, '') // Remove code blocks
    // Unwrap inline code rather than deleting it. Every api name in these docs is written
    // as code -- `cx`, `splitProps`, `css.raw` -- and those are the words people type into
    // search. Deleting them left `cx` in 8 of 829 records, all of them whole-page ones, so
    // no heading could ever match it and the query returned nothing.
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to text
    .replace(/#+\s*/g, '') // Remove heading markers
    .replace(/\n{3,}/g, '\n\n') // Normalize line breaks
    .trim()

  return content
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Create a unique ID for search records
 */
function createSearchId(baseSlug: string, headingId?: string): string {
  return headingId ? `${baseSlug}#${headingId}` : baseSlug
}

/**
 * Transform Velite docs to search-optimized records
 */
export function getSearchIndex(docs: Doc[]): SearchIndex {
  const searchRecords: SearchRecord[] = []

  // Process each document
  for (const doc of docs) {
    // Velite's slug already leads with `docs/` -- the route strips it back off with
    // `.split('/').slice(1)` in app/docs/[...slug]/page.tsx. Prefixing it again here
    // is what sent every search result to /docs/docs/<path>.
    //
    // The sidebar and pagination do prefix, correctly: their items come from
    // docs.config, which stores urls without it.
    const baseUrl = `/${doc.slug}`

    // Add main page record
    const pageRecord: SearchRecord = {
      id: createSearchId(doc.slug),
      url: baseUrl,
      title: doc.title,
      content: doc.llm,
      type: 'page',
      description: doc.description || doc.llm.slice(0, 150) + '...',
      breadcrumb: [doc.title],
    }
    searchRecords.push(pageRecord)

    // Add heading-level records
    for (let i = 0; i < doc.toc.length; i++) {
      const heading = doc.toc[i]
      const sectionContent = extractSectionContent(doc.llm, doc.toc, i)

      if (sectionContent.length > 50) {
        // Only index substantial content
        const headingRecord: SearchRecord = {
          id: createSearchId(doc.slug, heading.id),
          url: `${baseUrl}${heading.url}`,
          title: heading.title,
          content: sectionContent,
          type: 'heading',
          pageTitle: doc.title,
          headingLevel: heading.depth,
          description: sectionContent.slice(0, 150) + '...',
          breadcrumb: [doc.title],
        }
        searchRecords.push(headingRecord)
      }
    }
  }

  return {
    generated: new Date().toISOString(),
    totalRecords: searchRecords.length,
    records: searchRecords,
  }
}

/**
 * Convert search records to search items for UI
 */
export function convertToSearchItems(searchIndex: SearchIndex): SearchItem[] {
  return searchIndex.records.map(
    (record: SearchRecord): SearchItem => ({
      label: record.title,
      value: record.url,
      category: record.breadcrumb?.join(' › ') || 'Documentation',
      description: record.description || '',
      content: record.content,
      type: record.type,
    }),
  )
}

/**
 * Filter and group search items based on query using Fuse.js
 */
export function filterSearchItems(
  items: SearchItem[],
  _searchIndex: SearchIndex,
  query: string,
): Record<string, SearchItem[]> {
  if (!query) {
    // Show recent or popular items when no search query
    const popularItems = items.filter((item) => item.type === 'page').slice(0, 5)

    return popularItems.length ? { '': popularItems } : {}
  }

  // Configure Fuse.js for better fuzzy search
  const fuseOptions = {
    keys: [
      { name: 'label', weight: 0.5 }, // Title gets highest weight
      { name: 'description', weight: 0.2 }, // Description
      { name: 'content', weight: 0.2 }, // Content matching
      { name: 'category', weight: 0.1 }, // Category/breadcrumb
    ],
    // Fuzziness is a share of the query, so a fixed threshold buys a two-letter query far
    // more slack than a ten-letter one: at 0.2, `sva` matched "cssVarRoot" ahead of "Atomic
    // Slot Recipe (or sva)". Short queries in these docs are api names, where an exact
    // substring is what the reader means and a near-miss is noise, so they get no slack.
    threshold: query.length <= 3 ? 0 : 0.2,
    minMatchCharLength: 2, // Minimum character match length
    includeScore: true, // Include relevance score
    includeMatches: true, // Include match details
    // Score on whether the term appears, not where. With location scoring on (the default,
    // `distance: 100`) a match had to fall within about 100 characters of the start of the
    // field to clear the threshold at all -- and `content` holds a whole page or section, so
    // anything documented below the fold was unreachable. `token` found 59 records this way
    // and 285 without it; `cx` and `splitProps` found none.
    ignoreLocation: true,
    findAllMatches: true, // Find all matching patterns
    useExtendedSearch: true, // Enable advanced search patterns
  }

  const fuse = new Fuse(items, fuseOptions)
  const results = fuse.search(query)

  // Sort by relevance, and let type break ties only.
  //
  // This used to put every page above every heading before comparing scores at all, which
  // was survivable while content matching was broken and almost nothing matched. Once it
  // worked, any page mentioning the term in passing outranked the section actually about it:
  // searching `cx` led with "Get started with Bamboo" and never surfaced "cx resolves
  // conflicts". A heading is the more useful result anyway -- it links to the anchor.
  const sortedResults = results
    .sort((a, b) => {
      const byScore = (a.score || 1) - (b.score || 1)
      if (Math.abs(byScore) > 1e-6) return byScore

      if (a.item.type === b.item.type) return 0
      return a.item.type === 'heading' ? -1 : 1
    })
    .map((result) => result.item)
    .slice(0, 15)

  return sortedResults.length > 0 ? { '': sortedResults } : {}
}
