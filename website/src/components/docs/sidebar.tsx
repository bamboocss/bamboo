'use client'

import { Badge } from '@/components/ui/badge'
import { docsNavigation, type NavItem } from '@/docs.config'
import { ChevronDownIcon, ChevronRightIcon } from '@/icons'
import { css } from '@/styled-system/css'
import { flex } from '@/styled-system/patterns'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { LuArrowUpRight } from 'react-icons/lu'

interface SidebarItem {
  title: string
  slug: string
  external?: boolean
  href?: string
  tag?: string
  children?: SidebarItem[]
}

interface Props {
  slug?: string
}

export function Sidebar({ slug: currentSlug }: Props) {
  const pathname = usePathname()
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())

  // Use the sidebar structure from config
  const sidebarStructure: SidebarItem[] =
    docsNavigation.items?.map((section: NavItem) => ({
      title: section.title,
      slug: section.url || '',
      tag: section.tag,
      children: section.items?.map((item: NavItem) => ({
        title: item.title,
        slug: item.external ? item.href || '' : `${section.url}/${item.url}`,
        external: item.external,
        href: item.href,
        tag: item.tag,
      })),
    })) || []

  const toggleSection = (slug: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) {
        next.delete(slug)
      } else {
        next.add(slug)
      }
      return next
    })
  }

  const isActive = (slug: string) => {
    return pathname === `/docs/${slug}` || currentSlug === slug
  }

  const isSectionActive = (section: SidebarItem) => {
    return section.children?.some((child) => isActive(child.slug)) || false
  }

  return (
    <nav className={flex({ direction: 'column', gap: '1' })}>
      {sidebarStructure.map((section) => {
        const isExpanded = expandedSections.has(section.slug) || isSectionActive(section)
        const ChevronIcon = isExpanded ? ChevronDownIcon : ChevronRightIcon

        return (
          <div key={section.slug}>
            <button
              onClick={() => toggleSection(section.slug)}
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                w: 'full',
                // Leading edge flush with the column so the label lines up with the
                // logo; the hover fill runs the full width rather than sitting inset.
                px: 0,
                py: 2,
                rounded: 'md',
                fontWeight: 'semibold',
                fontSize: 'sm',
                color: 'fg',
                transitionProperty: 'background',
                transitionDuration: '200ms',
                _hover: {
                  bg: 'bg.subtle',
                },
                cursor: 'pointer',
              })}
            >
              <span className={flex({ align: 'center', gap: '8px' })}>
                <span>{section.title}</span>
                {section.tag && <Badge variant="solid">{section.tag}</Badge>}
              </span>
              {section.children && <ChevronIcon className={css({ w: '4', h: '4', color: 'fg.muted' })} />}
            </button>

            {isExpanded && section.children && (
              <div
                className={flex({
                  direction: 'column',
                  gap: '0',
                  mt: '1',
                  // Hairline the children hang off, so a section reads as one group and
                  // the active marker has something to sit on.
                  ms: '3',
                  borderInlineStartWidth: '1px',
                  borderColor: 'border.muted',
                })}
              >
                {section.children.map((item) => {
                  const linkStyles = css({
                    display: 'flex',
                    alignItems: 'center',
                    gap: '2',
                    // Sits on the rail: the 2px marker replaces the rail's own 1px, so
                    // the negative margin keeps the text from shifting when it appears.
                    ms: '-1px',
                    ps: '4',
                    pe: '3',
                    py: '1.5',
                    borderInlineStartWidth: '2px',
                    borderColor: 'transparent',
                    mixin: 'sm',
                    color: 'fg.muted',
                    fontWeight: 'normal',
                    transitionProperty: 'color, border-color',
                    transitionDuration: '150ms',
                    _hover: {
                      color: 'fg',
                      borderColor: 'border',
                    },
                    // A filled block here made navigation the loudest thing on the page.
                    // The marker and a weight change carry it instead.
                    _current: {
                      color: 'fg',
                      fontWeight: 'medium',
                      borderColor: 'accent',
                    },
                  })

                  if (item.external) {
                    return (
                      <a
                        key={item.slug}
                        href={item.href || item.slug}
                        data-current={isActive(item.slug) || undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkStyles}
                      >
                        {item.title}
                        <LuArrowUpRight />
                      </a>
                    )
                  }

                  return (
                    <Link
                      key={item.slug}
                      href={`/docs/${item.slug}`}
                      data-current={isActive(item.slug) || undefined}
                      className={linkStyles}
                    >
                      <span>{item.title}</span>
                      {item.tag && <Badge variant="solid">{item.tag}</Badge>}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
