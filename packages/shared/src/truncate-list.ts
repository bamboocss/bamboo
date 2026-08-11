/**
 * Findings shown in full before the rest become a count.
 *
 * A build error's job is to name the mistake, and a list long enough to scroll stops doing
 * that. One bad shared import produced 400 identical blocks and 1,221 lines of stderr
 * carrying one line of information — the message itself was good, and it scrolled past 400
 * times. Ten is enough to see a pattern in what is listed, and short enough that the
 * paragraph explaining the failure is still on screen with it.
 */
const DEFAULT_LIMIT = 10

export interface TruncateListOptions {
  /** Entries rendered in full. The rest are counted. */
  limit?: number
  /**
   * What the remainder is counted in — "file", "call", "value", "binding".
   *
   * Pluralized by appending `s`, so a word that does not take one is the caller's problem.
   * That is why the default is `item` rather than `entry`: everything a diagnostic counts
   * here is a regular noun, and a rule that quietly produced "entrys" is worse than one that
   * asks for a word it can handle.
   */
  unit?: string
  /** Between entries. Two newlines for block-shaped entries, one for line-shaped ones. */
  separator?: string
}

/**
 * Render a list of findings, capped, with a line saying what was withheld.
 *
 * The count is of what was *left out*, not of the whole set: callers already open with the
 * total ("400 call(s) name a binding that does not exist"), so repeating it here would state
 * the same number twice and leave the reader working out which one the list is a subset of.
 *
 * Returns the entries joined and nothing else when they fit, so a build reporting two
 * problems reads exactly as it did before this existed.
 */
export function truncateList(entries: string[], options: TruncateListOptions = {}): string {
  const { limit = DEFAULT_LIMIT, unit = 'item', separator = '\n\n' } = options

  if (entries.length <= limit) return entries.join(separator)

  const withheld = entries.length - limit
  const plural = withheld === 1 ? unit : `${unit}s`

  return [...entries.slice(0, limit), `… and ${withheld} more ${plural}.`].join(separator)
}

/**
 * Group findings that are the same mistake, so a repeated one is reported once.
 *
 * Capping alone is not enough when every entry is identical. `stack` dropped from a preset
 * and called in 400 files is one thing to fix, and a list of ten of those files says no more
 * than a list of one — while hiding that the other 390 share a cause rather than having 390
 * causes of their own.
 *
 * `key` decides what counts as the same mistake and `label` renders it once; the members are
 * whatever locates each occurrence.
 */
export function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()

  for (const item of items) {
    const k = key(item)
    const group = groups.get(k)
    if (group) group.push(item)
    else groups.set(k, [item])
  }

  return groups
}
