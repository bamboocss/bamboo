import {
  BambooError,
  getOrCreateSet,
  getRecipeIdentity,
  getSlotCompoundVariant,
  isObjectOrArray,
  normalizeStyleObject,
  traverse,
  uniq,
  viewTransitionClassName,
  viewTransitionSlots,
} from '@bamboocss/shared'
import type {
  Dict,
  EncoderJson,
  PartialBy,
  RecipeConfig,
  RecipeDefinition,
  ResultItem,
  SlotRecipeDefinition,
  StyleEntry,
  StyleProps,
  StyleResultObject,
} from '@bamboocss/types'
import { version } from '../package.json'
import type { Context } from './context'
import { COMPOUND_VARIANT, Recipes } from './recipes'
import {
  captureStyleContributionJsonObject,
  parseContributionHash,
  restoreStyleContributionJsonObject,
  StyleContributionError,
} from './style-contribution'

const urlRegex = /^https?:\/\//

/**
 * The subset of an encoder's work that a single `process*` call is responsible for.
 *
 * The encoder accumulates across calls — that is what lets one stylesheet be built
 * from many sources. A caller that wants the class names for *its* styles (rather
 * than for everything encoded so far) records a scope and resolves it against the
 * decoder. See `StyleDecoder.filterClassNames`.
 *
 * Membership is recorded even when the underlying hash was already present, since
 * the class name still belongs to this call's result.
 */
export interface EncoderScope {
  atomic: Set<string>
  /** recipe name -> variant hashes contributed by this call */
  recipes: Map<string, Set<string>>
  /** Recipe collection order, including the synthetic hashes `recipes` deliberately omits. */
  recipe_order: Map<string, Set<string>>
  /** recipe keys (`name` or `name{slotSeparator}slot`) whose base belongs to this call */
  recipes_base: Set<string>
  /**
   * Recipe names whose compound-variant block this call is responsible for.
   *
   * Kept apart from `recipes` on purpose: a compound rule selects on the variant classes the
   * element already carries and contributes no class of its own, so `filterClassNames` must
   * not see it (see `hashCompoundVariants`). This field is read only by `withOwner`, which
   * needs to know what a re-parse is allowed to hand back.
   *
   * Lazily allocated, as are the two below. `withScope` runs once per call site and the
   * common one -- `css({ ... })` -- reaches none of the three.
   */
  compound_variants?: Set<string>
  /** `viewTransition()` classes this call encoded. */
  view_transitions?: Set<string>
  /** Exact input and normalized declaration order for each transition this call encoded. */
  view_transition_payloads?: Map<string, ViewTransitionPayload>
  /** Recipe names this call observed, which is the list `atomizeObservedRecipes` walks. */
  observed_recipes?: Set<string>
  /** Inline recipe configs registered while this owner was active. */
  inline_recipes?: Map<string, InlineRecipeContribution>
}

interface InlineRecipeContribution {
  kind: 'cva' | 'sva'
  identitySlots: string[] | null
  config: RecipeConfig | SlotRecipeDefinition
}

interface ViewTransitionPayload {
  /** Absent only for a pinned legacy `fromJSON` transition, whose dump did not store its input. */
  input?: StyleResultObject
  slots: StyleResultObject
}

const createScope = (): EncoderScope => ({
  atomic: new Set(),
  recipes: new Map(),
  recipe_order: new Map(),
  recipes_base: new Set(),
})

const mergeSet = <T>(target: Set<T> | undefined, source: Set<T> | undefined) => {
  if (!source?.size) return target
  const set = target ?? new Set<T>()
  source.forEach((value) => set.add(value))
  return set
}

const mergeScope = (target: EncoderScope, source: EncoderScope) => {
  source.atomic.forEach((hash) => target.atomic.add(hash))
  source.recipes_base.forEach((key) => target.recipes_base.add(key))
  source.recipes.forEach((hashes, name) => {
    const set = getOrCreateSet(target.recipes, name)
    hashes.forEach((hash) => set.add(hash))
  })
  source.recipe_order.forEach((hashes, name) => {
    const set = getOrCreateSet(target.recipe_order, name)
    hashes.forEach((hash) => set.add(hash))
  })
  target.compound_variants = mergeSet(target.compound_variants, source.compound_variants)
  target.view_transitions = mergeSet(target.view_transitions, source.view_transitions)
  source.view_transition_payloads?.forEach((payload, className) => {
    const payloads = (target.view_transition_payloads ??= new Map())
    payloads.set(className, payload)
  })
  target.observed_recipes = mergeSet(target.observed_recipes, source.observed_recipes)
  source.inline_recipes?.forEach((recipe, name) => {
    const recipes = (target.inline_recipes ??= new Map())
    if (!recipes.has(name)) recipes.set(name, recipe)
  })
}

/** A key nothing may take away: encoded with no owner recording, so no owner can release it. */
const PINNED = -1

/**
 * How many owners hold each key of one collection.
 *
 * Refcounted rather than scanned. Two files routinely encode the same declaration, so
 * "does anyone else still want this" has to be answerable without walking the other owners
 * -- that walk is O(project) per edit, which is the cost this whole mechanism exists to
 * avoid.
 */
class Refs {
  private counts = new Map<string, number>()

  /** Mark a key as belonging to no owner. Nothing can release it afterwards. */
  pin = (key: string) => {
    this.counts.set(key, PINNED)
  }

  retain = (key: string) => {
    const count = this.counts.get(key)
    if (count === PINNED) return
    this.counts.set(key, (count ?? 0) + 1)
  }

  /** Whether exactly one owner currently holds this key. */
  isSoleOwner = (key: string) => this.counts.get(key) === 1

  /** Whether ownerless work made this key permanent. */
  isPinned = (key: string) => this.counts.get(key) === PINNED

  /** Whether no pinned or owner-held membership exists yet. */
  isUntracked = (key: string) => this.counts.get(key) === undefined

  /** Whether this encoder currently has any file owner for this key. */
  hasOwner = (key: string) => {
    const count = this.counts.get(key)
    return count !== undefined && count !== PINNED
  }

  /** True when the last owner let go, and the key should leave its collection with it. */
  release = (key: string): boolean => {
    const count = this.counts.get(key)
    // Untracked: pinned, or put there before anything recorded ownership. Either way nothing
    // here is what added it, so nothing here may remove it.
    if (count === undefined || count === PINNED) return false
    if (count > 1) {
      this.counts.set(key, count - 1)
      return false
    }
    this.counts.delete(key)
    return true
  }
}

interface OrderNode {
  key?: string
  previous: OrderNode | null
  next: OrderNode | null
}

interface OrderOwnerRank {
  phase: 0 | 1
  sequence: number
  subSequence: number
  serial: number
}

interface OrderOwnerNode {
  rank: OrderOwnerRank
  priority: number
  marker: OrderNode
  left: OrderOwnerNode | null
  right: OrderOwnerNode | null
}

interface OrderUpdateResult {
  changed: boolean
  work: number
}

interface EffectiveOrderOwner {
  owner: string
  rank: OrderOwnerRank
  order: number
}

const orderOwnerPriority = (serial: number) => {
  let value = serial | 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return (value ^ (value >>> 16)) >>> 0
}

const orderOwnerBefore = (left: OrderOwnerNode, right: OrderOwnerNode) =>
  left.priority < right.priority ||
  (left.priority === right.priority && compareOrderOwnerRanks(left.rank, right.rank) < 0)

const compareOrderOwnerRanks = (left: OrderOwnerRank, right: OrderOwnerRank) =>
  left.phase - right.phase ||
  left.sequence - right.sequence ||
  left.subSequence - right.subSequence ||
  left.serial - right.serial

const insertOrderOwner = (root: OrderOwnerNode | null, inserted: OrderOwnerNode): OrderOwnerNode => {
  if (!root) return inserted
  if (compareOrderOwnerRanks(inserted.rank, root.rank) < 0) {
    root.left = insertOrderOwner(root.left, inserted)
    if (orderOwnerBefore(root.left, root)) {
      const next = root.left
      root.left = next.right
      next.right = root
      return next
    }
  } else {
    root.right = insertOrderOwner(root.right, inserted)
    if (orderOwnerBefore(root.right, root)) {
      const next = root.right
      root.right = next.left
      next.left = root
      return next
    }
  }
  return root
}

const deleteOrderOwner = (root: OrderOwnerNode | null, rank: OrderOwnerRank): OrderOwnerNode | null => {
  if (!root) return null
  const compared = compareOrderOwnerRanks(rank, root.rank)
  if (compared < 0) root.left = deleteOrderOwner(root.left, rank)
  else if (compared > 0) root.right = deleteOrderOwner(root.right, rank)
  else if (!root.left) return root.right
  else if (!root.right) return root.left
  else if (orderOwnerBefore(root.left, root.right)) {
    const next = root.left
    root.left = next.right
    next.right = root
    next.right = deleteOrderOwner(next.right, rank)
    return next
  } else {
    const next = root.right
    root.right = next.left
    next.left = root
    next.left = deleteOrderOwner(next.left, rank)
    return next
  }
  return root
}

const findOrderOwnerAtOrAfter = (root: OrderOwnerNode | null, rank: OrderOwnerRank) => {
  let current = root
  let found: OrderOwnerNode | null = null
  while (current) {
    if (compareOrderOwnerRanks(current.rank, rank) >= 0) {
      found = current
      current = current.left
    } else current = current.right
  }
  return found
}

interface KeyOwnerOccurrence {
  owner: string
  rank: OrderOwnerRank
  order: number
  index: number
}

const occurrenceBefore = (left: KeyOwnerOccurrence, right: KeyOwnerOccurrence) => {
  const owners = compareOrderOwnerRanks(left.rank, right.rank)
  return owners < 0 || (owners === 0 && left.order < right.order)
}

/** Indexed minimum heap for the live owners of one shared collection key. */
class KeyOwnerIndex {
  private heap: KeyOwnerOccurrence[] = []
  private byOwner = new Map<string, KeyOwnerOccurrence>()

  get first() {
    return this.heap[0]
  }

  get size() {
    return this.heap.length
  }

  getOrder = (owner: string) => this.byOwner.get(owner)?.order

  ownerNames = () => this.byOwner.keys()

  upsert = (owner: string, rank: OrderOwnerRank, order: number) => {
    let occurrence = this.byOwner.get(owner)
    if (!occurrence) {
      occurrence = { owner, rank, order, index: this.heap.length }
      this.heap.push(occurrence)
      this.byOwner.set(owner, occurrence)
    } else {
      occurrence.rank = rank
      occurrence.order = order
    }
    return this.repair(occurrence.index)
  }

  remove = (owner: string) => {
    const occurrence = this.byOwner.get(owner)
    if (!occurrence) return 0
    this.byOwner.delete(owner)
    const last = this.heap.pop()!
    if (last === occurrence) return 0
    this.heap[occurrence.index] = last
    last.index = occurrence.index
    return this.repair(last.index)
  }

  private repair = (index: number) => {
    const raised = this.raise(index)
    return raised.work + this.lower(raised.index)
  }

  private raise = (start: number) => {
    let index = start
    let work = 0
    while (index > 0) {
      const parent = (index - 1) >> 1
      work++
      if (!occurrenceBefore(this.heap[index], this.heap[parent])) break
      this.swap(index, parent)
      index = parent
    }
    return { index, work }
  }

  private lower = (start: number) => {
    let index = start
    let work = 0
    while (true) {
      const left = index * 2 + 1
      if (left >= this.heap.length) break
      const right = left + 1
      let next = left
      work++
      if (right < this.heap.length) {
        work++
        if (occurrenceBefore(this.heap[right], this.heap[left])) next = right
      }
      if (!occurrenceBefore(this.heap[next], this.heap[index])) break
      this.swap(index, next)
      index = next
    }
    return work
  }

  private swap = (left: number, right: number) => {
    const value = this.heap[left]
    this.heap[left] = this.heap[right]
    this.heap[right] = value
    this.heap[left].index = left
    this.heap[right].index = right
  }
}

interface ViewTransitionPayloadOccurrence {
  owner: string
  rank: OrderOwnerRank
  payload: ViewTransitionPayload
  index: number
}

const payloadOccurrenceLater = (left: ViewTransitionPayloadOccurrence, right: ViewTransitionPayloadOccurrence) =>
  compareOrderOwnerRanks(left.rank, right.rank) > 0

/** Indexed maximum heap for the exact payload written by the latest live transition owner. */
class ViewTransitionPayloadIndex {
  private heap: ViewTransitionPayloadOccurrence[] = []
  private byOwner = new Map<string, ViewTransitionPayloadOccurrence>()
  private pinnedPayload: ViewTransitionPayload | undefined

  /** Permanent ownerless work is authoritative; otherwise the latest file owner wins. */
  get winner() {
    return this.pinnedPayload ?? this.heap[0]?.payload
  }

  get size() {
    return this.heap.length
  }

  get isPinned() {
    return this.pinnedPayload !== undefined
  }

  pin = (payload: ViewTransitionPayload) => {
    this.pinnedPayload = payload
  }

  upsert = (owner: string, rank: OrderOwnerRank, payload: ViewTransitionPayload) => {
    let occurrence = this.byOwner.get(owner)
    if (!occurrence) {
      occurrence = { owner, rank, payload, index: this.heap.length }
      this.heap.push(occurrence)
      this.byOwner.set(owner, occurrence)
    } else {
      occurrence.rank = rank
      occurrence.payload = payload
    }
    return this.repair(occurrence.index)
  }

  remove = (owner: string) => {
    const occurrence = this.byOwner.get(owner)
    if (!occurrence) return 0
    this.byOwner.delete(owner)
    const last = this.heap.pop()!
    if (last === occurrence) return 0
    this.heap[occurrence.index] = last
    last.index = occurrence.index
    return this.repair(last.index)
  }

  private repair = (index: number) => {
    const raised = this.raise(index)
    return raised.work + this.lower(raised.index)
  }

  private raise = (start: number) => {
    let index = start
    let work = 0
    while (index > 0) {
      const parent = (index - 1) >> 1
      work++
      if (!payloadOccurrenceLater(this.heap[index], this.heap[parent])) break
      this.swap(index, parent)
      index = parent
    }
    return { index, work }
  }

  private lower = (start: number) => {
    let index = start
    let work = 0
    while (true) {
      const left = index * 2 + 1
      if (left >= this.heap.length) break
      const right = left + 1
      let next = left
      work++
      if (right < this.heap.length) {
        work++
        if (payloadOccurrenceLater(this.heap[right], this.heap[left])) next = right
      }
      if (!payloadOccurrenceLater(this.heap[next], this.heap[index])) break
      this.swap(index, next)
      index = next
    }
    return work
  }

  private swap = (left: number, right: number) => {
    const value = this.heap[left]
    this.heap[left] = this.heap[right]
    this.heap[right] = value
    this.heap[left].index = left
    this.heap[right].index = right
  }
}

/** Linked iteration order whose touched nodes can move without scanning unrelated entries. */
class OrderIndex {
  private nodes = new Map<string, OrderNode>()
  private owners = new Map<string, OrderOwnerNode>()
  /** Local key order for each owner that currently contributes to this collection. */
  private ownerKeys = new Map<string, Map<string, number>>()
  /** Owners of one key. Only this small set is visited when its earliest occurrence changes. */
  private keyOwners = new Map<string, KeyOwnerIndex>()
  /** The earliest owner occurrence that determines a key's aggregate insertion position. */
  private effectiveOwners = new Map<string, string>()
  /** Keys currently positioned by each earliest owner, for bounded group reconciliation. */
  private effectiveKeys = new Map<string, Set<string>>()
  private ownerTree: OrderOwnerNode | null = null
  private first: OrderNode | null = null
  private last: OrderNode | null = null

  add = (key: string) => {
    if (this.nodes.has(key)) return
    const node: OrderNode = { key, previous: this.last, next: null }
    if (this.last) this.last.next = node
    else this.first = node
    this.last = node
    this.nodes.set(key, node)
  }

  delete = (key: string) => {
    const node = this.nodes.get(key)
    if (!node) return
    this.detach(node)
    this.nodes.delete(key)
  }

  clear = () => {
    this.nodes.clear()
    this.owners.clear()
    this.ownerKeys.clear()
    this.keyOwners.clear()
    this.effectiveOwners.clear()
    this.effectiveKeys.clear()
    this.ownerTree = null
    this.first = null
    this.last = null
  };

  *keys(): IterableIterator<string> {
    let node = this.first
    while (node) {
      if (node.key !== undefined) yield node.key
      node = node.next
    }
  }

  ensureOwner = (owner: string, rank: OrderOwnerRank) => {
    if (this.owners.has(owner)) return false
    const successor = findOrderOwnerAtOrAfter(this.ownerTree, rank)?.marker ?? null
    const marker: OrderNode = { previous: successor ? successor.previous : this.last, next: successor }
    if (marker.previous) marker.previous.next = marker
    else this.first = marker
    if (successor) successor.previous = marker
    else this.last = marker
    const ownerNode: OrderOwnerNode = {
      rank,
      priority: orderOwnerPriority(rank.serial),
      marker,
      left: null,
      right: null,
    }
    this.owners.set(owner, ownerNode)
    this.ownerTree = insertOrderOwner(this.ownerTree, ownerNode)
    return true
  }

  removeOwner = (owner: string) => {
    const entry = this.owners.get(owner)
    if (!entry) return false
    this.detach(entry.marker)
    this.owners.delete(owner)
    this.ownerTree = deleteOrderOwner(this.ownerTree, entry.rank)
    return true
  }

  updateOwnerRanks = (updates: ReadonlyMap<string, OrderOwnerRank>) => {
    const entries = Array.from(updates, ([owner, rank]) => ({ entry: this.owners.get(owner)!, owner, rank }))
    const affectedKeys = new Set<string>()
    entries.forEach(({ owner }) => this.ownerKeys.get(owner)?.forEach((_, key) => affectedKeys.add(key)))
    const previousEffective = new Map<string, { owner: string | undefined; order: number | undefined }>()
    affectedKeys.forEach((key) => {
      const owner = this.effectiveOwners.get(key)
      previousEffective.set(key, { owner, order: owner ? this.keyOwners.get(key)?.getOrder(owner) : undefined })
    })
    entries.forEach(({ entry }) => {
      this.detach(entry.marker)
      this.ownerTree = deleteOrderOwner(this.ownerTree, entry.rank)
    })
    entries
      .sort((left, right) => compareOrderOwnerRanks(left.rank, right.rank))
      .forEach(({ entry, rank }) => {
        entry.rank = rank
        entry.left = null
        entry.right = null
        const successor = findOrderOwnerAtOrAfter(this.ownerTree, rank)?.marker ?? null
        const previous = successor ? successor.previous : this.last
        entry.marker.previous = previous
        entry.marker.next = successor
        if (previous) previous.next = entry.marker
        else this.first = entry.marker
        if (successor) successor.previous = entry.marker
        else this.last = entry.marker
        this.ownerTree = insertOrderOwner(this.ownerTree, entry)
      })

    const impactedOwners = new Set<string>()
    let changed = false
    let work = 0
    entries.forEach(({ owner, rank }) => {
      this.ownerKeys.get(owner)?.forEach((order, key) => {
        work += this.keyOwners.get(key)?.upsert(owner, rank, order) ?? 0
      })
    })
    entries.forEach(({ owner }) => {
      if (this.effectiveKeys.get(owner)?.size) impactedOwners.add(owner)
    })
    affectedKeys.forEach((key) => {
      const previous = previousEffective.get(key)!
      const next = this.findEffectiveOwner(key)
      work += next.work
      if (previous.owner !== next.value?.owner) {
        changed = true
        this.setEffectiveOwner(key, previous.owner, next.value?.owner)
        if (previous.owner) impactedOwners.add(previous.owner)
        if (next.value) impactedOwners.add(next.value.owner)
      }
    })
    if (impactedOwners.size) changed = true
    work += this.repositionEffectiveOwners(impactedOwners)
    return { changed, work } satisfies OrderUpdateResult
  }

  /**
   * Replace one owner's local ordering metadata and reconcile the affected shared keys.
   *
   * Aggregate Set/Map insertion order is the first active occurrence of a key: earliest owner
   * rank, then that owner's local index. A shared key therefore moves when its earliest owner
   * reorders or releases it, without consulting any unrelated owner or collection entry.
   */
  replaceOwnerKeys = (owner: string, keys: Iterable<string>, isPinned: (key: string) => boolean): OrderUpdateResult => {
    const desired = new Map<string, number>()
    let nextOrder = 0
    for (const key of keys) {
      if (!desired.has(key)) desired.set(key, nextOrder++)
    }
    const previous = this.ownerKeys.get(owner) ?? new Map<string, number>()
    const affectedKeys = new Set([...previous.keys(), ...desired.keys()])
    const previousEffective = new Map<string, { owner: string | undefined; order: number | undefined }>()
    affectedKeys.forEach((key) => {
      const effective = this.effectiveOwners.get(key)
      previousEffective.set(key, {
        owner: effective,
        order: effective ? this.keyOwners.get(key)?.getOrder(effective) : undefined,
      })
    })

    const stored = new Map<string, number>()
    let work = 0
    affectedKeys.forEach((key) => {
      work++
      const owners = this.keyOwners.get(key) ?? new KeyOwnerIndex()
      if (isPinned(key)) {
        for (const keyOwner of owners.ownerNames()) {
          this.ownerKeys.get(keyOwner)?.delete(key)
          work++
        }
        this.keyOwners.delete(key)
        return
      }

      const order = desired.get(key)
      if (order === undefined) work += owners.remove(owner)
      else {
        work += owners.upsert(owner, this.owners.get(owner)!.rank, order)
        stored.set(key, order)
      }
      if (owners.size) this.keyOwners.set(key, owners)
      else this.keyOwners.delete(key)
    })
    if (stored.size) this.ownerKeys.set(owner, stored)
    else this.ownerKeys.delete(owner)

    const impactedOwners = new Set<string>()
    let changed = false
    affectedKeys.forEach((key) => {
      const before = previousEffective.get(key)!
      const next = this.findEffectiveOwner(key)
      work += next.work
      const localOrderChanged = before.owner === next.value?.owner && before.order !== next.value?.order
      if (before.owner !== next.value?.owner) {
        this.setEffectiveOwner(key, before.owner, next.value?.owner)
        if (before.owner) impactedOwners.add(before.owner)
        if (next.value) impactedOwners.add(next.value.owner)
        changed = true
      } else if (localOrderChanged && next.value) {
        impactedOwners.add(next.value.owner)
        changed = true
      }
    })
    work += this.repositionEffectiveOwners(impactedOwners)
    return { changed, work }
  }

  getEffectiveOwner = (key: string): EffectiveOrderOwner | undefined => {
    const owner = this.effectiveOwners.get(key)
    if (!owner) return
    const rank = this.owners.get(owner)?.rank
    const order = this.keyOwners.get(key)?.getOrder(owner)
    if (!rank || order === undefined) return
    return { owner, rank, order }
  }

  /** Freeze a permanent key at its current concrete position and discard owner ordering. */
  pinKey = (key: string) => {
    const owners = this.keyOwners.get(key)
    let work = 0
    for (const owner of owners?.ownerNames() ?? []) {
      this.ownerKeys.get(owner)?.delete(key)
      work++
    }
    this.keyOwners.delete(key)
    this.setEffectiveOwner(key, this.effectiveOwners.get(key), undefined)
    return work
  }

  repositionAfterOwner = (keys: readonly string[], owner: string) => {
    const moving = keys.map((key) => this.nodes.get(key)).filter((node): node is OrderNode => !!node)
    moving.forEach((node) => this.detach(node))
    let previous = this.owners.get(owner)?.marker ?? null
    for (const node of moving) {
      if (previous === null) {
        node.previous = null
        node.next = this.first
        if (this.first) this.first.previous = node
        else this.last = node
        this.first = node
      } else {
        node.previous = previous
        node.next = previous.next
        if (previous.next) previous.next.previous = node
        else this.last = node
        previous.next = node
      }
      previous = node
    }
  }

  private findEffectiveOwner = (key: string): { value: EffectiveOrderOwner | undefined; work: number } => {
    const occurrence = this.keyOwners.get(key)?.first
    return {
      value: occurrence ? { owner: occurrence.owner, rank: occurrence.rank, order: occurrence.order } : undefined,
      work: occurrence ? 1 : 0,
    }
  }

  private setEffectiveOwner = (key: string, previous: string | undefined, next: string | undefined) => {
    if (previous) {
      const keys = this.effectiveKeys.get(previous)
      keys?.delete(key)
      if (keys?.size === 0) this.effectiveKeys.delete(previous)
    }
    if (next) {
      const keys = this.effectiveKeys.get(next) ?? new Set<string>()
      keys.add(key)
      this.effectiveKeys.set(next, keys)
      this.effectiveOwners.set(key, next)
    } else this.effectiveOwners.delete(key)
  }

  private repositionEffectiveOwners = (owners: ReadonlySet<string>) => {
    let work = 0
    Array.from(owners)
      .sort((left, right) => compareOrderOwnerRanks(this.owners.get(left)!.rank, this.owners.get(right)!.rank))
      .forEach((owner) => {
        const keys = Array.from(this.effectiveKeys.get(owner) ?? [])
          .filter((key) => this.nodes.has(key))
          .sort(
            (left, right) => this.keyOwners.get(left)!.getOrder(owner)! - this.keyOwners.get(right)!.getOrder(owner)!,
          )
        work += keys.length
        this.repositionAfterOwner(keys, owner)
      })
    return work
  }

  private detach = (node: OrderNode) => {
    if (node.previous) node.previous.next = node.next
    else this.first = node.next
    if (node.next) node.next.previous = node.previous
    else this.last = node.previous
    node.previous = null
    node.next = null
  }
}

class OrderableSet extends Set<string> {
  private order = new OrderIndex()

  constructor(values?: Iterable<string>) {
    super()
    if (values) for (const value of values) this.add(value)
  }

  override add(value: string) {
    if (!super.has(value)) this.order.add(value)
    super.add(value)
    return this
  }

  override delete(value: string) {
    const removed = super.delete(value)
    if (removed) this.order.delete(value)
    return removed
  }

  override clear() {
    super.clear()
    this.order.clear()
  }

  override values = () => this.order.keys() as SetIterator<string>
  override keys = this.values
  override [Symbol.iterator] = this.values
  override entries = () =>
    (function* (values: Iterable<string>) {
      for (const value of values) yield [value, value] as [string, string]
    })(this.order.keys()) as SetIterator<[string, string]>

  override forEach(callback: (value: string, key: string, set: Set<string>) => void, thisArg?: unknown) {
    for (const value of this.order.keys()) callback.call(thisArg, value, value, this)
  }

  ensureOwner = (owner: string, rank: OrderOwnerRank) => this.order.ensureOwner(owner, rank)
  removeOwner = (owner: string) => this.order.removeOwner(owner)
  updateOwnerRanks = (updates: ReadonlyMap<string, OrderOwnerRank>) => this.order.updateOwnerRanks(updates)
  replaceOwnerKeys = (owner: string, keys: Iterable<string>, isPinned: (key: string) => boolean) =>
    this.order.replaceOwnerKeys(owner, keys, isPinned)
  getEffectiveOwner = (key: string) => this.order.getEffectiveOwner(key)
  pinKey = (key: string) => this.order.pinKey(key)
  repositionAfterOwner = (keys: readonly string[], owner: string) => this.order.repositionAfterOwner(keys, owner)
}

class OrderableMap<T> extends Map<string, T> {
  private order = new OrderIndex()

  constructor(values?: Iterable<readonly [string, T]>) {
    super()
    if (values) for (const [key, value] of values) this.set(key, value)
  }

  override set(key: string, value: T) {
    if (!super.has(key)) this.order.add(key)
    super.set(key, value)
    return this
  }

  override delete(key: string) {
    const removed = super.delete(key)
    if (removed) this.order.delete(key)
    return removed
  }

  override clear() {
    super.clear()
    this.order.clear()
  }

  override keys = () => this.order.keys() as MapIterator<string>
  override values = () =>
    (function* (map: OrderableMap<T>, keys: Iterable<string>) {
      for (const key of keys) yield map.get(key)!
    })(this, this.order.keys()) as MapIterator<T>
  override entries = () =>
    (function* (map: OrderableMap<T>, keys: Iterable<string>) {
      for (const key of keys) yield [key, map.get(key)!] as [string, T]
    })(this, this.order.keys()) as MapIterator<[string, T]>
  override [Symbol.iterator] = this.entries

  override forEach(callback: (value: T, key: string, map: Map<string, T>) => void, thisArg?: unknown) {
    for (const key of this.order.keys()) callback.call(thisArg, this.get(key)!, key, this)
  }

  ensureOwner = (owner: string, rank: OrderOwnerRank) => this.order.ensureOwner(owner, rank)
  removeOwner = (owner: string) => this.order.removeOwner(owner)
  updateOwnerRanks = (updates: ReadonlyMap<string, OrderOwnerRank>) => this.order.updateOwnerRanks(updates)
  replaceOwnerKeys = (owner: string, keys: Iterable<string>, isPinned: (key: string) => boolean) =>
    this.order.replaceOwnerKeys(owner, keys, isPinned)
  getEffectiveOwner = (key: string) => this.order.getEffectiveOwner(key)
  pinKey = (key: string) => this.order.pinKey(key)
  repositionAfterOwner = (keys: readonly string[], owner: string) => this.order.repositionAfterOwner(keys, owner)
}

type OrderableCollection = OrderableSet | OrderableMap<unknown>

/**
 * The owner key for one entry point's reading of one file.
 *
 * Kinds are separate owners over the same path on purpose. A Vite dev server reads a module
 * twice -- once from disk in the extraction pass, once from the transform pipeline -- and the
 * two can legitimately see different source (an SFC's sub-modules, a plugin that ran first).
 * One shared key would let each replace the other's record, and a file's rules would disappear
 * on whichever read was narrower. Two keys let the refcounts hold the union instead.
 */
const ownerKey = (kind: OwnerKind, path: string) => `${kind}:${kind === 'recipe' ? path : path.replace(/\\/g, '/')}`

/**
 * Which entry point read a file.
 *
 * `extract` is the CSS extraction pass, which reads every file in `include` off disk.
 * `parse` is a bundler transform, which reads the module source it is handed.
 */
export type FileOwnerKind = 'extract' | 'parse'

type OwnerKind = FileOwnerKind | 'recipe'

/** Every owner kind keyed by a file path, for releasing one whose file was deleted. */
const FILE_OWNER_KINDS: FileOwnerKind[] = ['extract', 'parse']

export class StyleEncoder {
  static separator = ']___['
  static conditionSeparator = '<___>'

  atomic: Set<string> = new OrderableSet()
  compound_variants: Set<string> = new OrderableSet()
  //
  recipes: Map<string, Set<string>> = new OrderableMap()
  recipes_base: Map<string, Set<string>> = new OrderableMap()

  /** Recipes observed by extraction, including an inline recipe with only a base. */
  private observedRecipes: Set<string> = new OrderableSet()
  /** Recipes whose authored declarations have already been interned as utility atoms. */
  private atomizedRecipes = new Set<string>()

  /**
   * Bag class -> the slot styles behind it.
   *
   * Keyed by class rather than hashed per declaration like everything above: a bag emits
   * whole rules against `::view-transition-*` pseudo-elements, which no atomic class can
   * carry, so there is nothing to deduplicate at the property level. Keying by the class
   * is what collapses two calls that wrote the same options.
   */
  view_transitions: Map<string, StyleResultObject> = new OrderableMap()
  /** The filtered, unnormalized slots whose stable hash produced each transition class. */
  private viewTransitionInputs: Map<string, StyleResultObject> = new OrderableMap()

  /**
   * Scope being recorded by the innermost `withScope` on the stack, if any.
   * Encoding is synchronous, so a single field is enough to thread this through
   * nested `process*` calls without changing their signatures.
   */
  private activeScope: EncoderScope | null = null

  /**
   * Run `fn` and report the work it encoded. Nested scopes merge into their parent,
   * so `processAtomicRecipe` recording through `processAtomic` still attributes
   * every hash to the outer call.
   */
  withScope = (fn: () => void): EncoderScope => {
    const parent = this.activeScope
    const scope = createScope()
    this.activeScope = scope
    try {
      fn()
    } finally {
      this.activeScope = parent
    }
    if (parent) mergeScope(parent, scope)
    return scope
  }

  /** What each owner contributed the last time it was read. @see withOwner */
  private owners = new Map<string, EncoderScope>()
  /** The owner `withOwner` is recording for, if any. Nested calls defer to the outermost. */
  private activeOwner: string | null = null

  /** Stable owner rank shared by every ordered registry, including registries first touched later. */
  private ownerOrderRanks = new Map<string, OrderOwnerRank>()
  private nextFileOwnerOrderRank = 0
  private nextRecipeOwnerOrderRank = 0
  private nextOwnerOrderSerial = 0
  /** Every collection holding an owner's invisible order marker, for bounded final cleanup. */
  private ownerOrderCollections = new Map<string, Set<OrderableCollection>>()

  private atomicRefs = new Refs()
  private recipeRefs = new Refs()
  private recipeEntryRefs = new Refs()
  private recipeBaseRefs = new Refs()
  private compoundRefs = new Refs()
  private viewTransitionRefs = new Refs()
  /** Exact ordered payload occurrences, independent from the transition class's key position. */
  private viewTransitionPayloads = new Map<string, ViewTransitionPayloadIndex>()
  private observedRefs = new Refs()
  private inlineRecipeRefs = new Refs()

  /** A recipe's compound-variant hashes, so releasing the block can find them again. */
  private compoundHashes = new Map<string, Set<string>>()

  /** Stable evidence that contribution replay visits contributions, never the owner table. */
  private ownerWork = 0
  /** Stable evidence that order repair visits only changed keys and those keys' co-owners. */
  private ownerOrderWork = 0
  /** Stable evidence that transition payload fallback uses indexed affected-key owners only. */
  private ownerPayloadWork = 0

  /** Changes to inline recipe transforms whose stable hashes can outlive their old styles. */
  private inlineRecipeRevision = 0

  /** Owner-local collection order or exact aggregate payload changes that require a decoder rebuild. */
  private ownerOrderRevision = 0

  /** @internal Work units spent retaining/releasing owner membership. */
  get ownerWorkCount() {
    return this.ownerWork
  }

  /** @internal Work units spent reconciling shared ordered membership. */
  get ownerOrderWorkCount() {
    return this.ownerOrderWork
  }

  /** @internal Work units spent selecting exact shared view-transition payloads. */
  get ownerPayloadWorkCount() {
    return this.ownerPayloadWork
  }

  /** @internal Decoder cache generation for owner-refreshed inline recipes. */
  get recipeRevision() {
    return this.inlineRecipeRevision
  }

  /** @internal Decoder generation for semantic Set/Map order or value changes. */
  get orderRevision() {
    return this.ownerOrderRevision
  }

  /**
   * How many times something has actually left a collection.
   *
   * Read by `StyleDecoder.collect`, which accumulates the results it decodes: a hash that is
   * gone from here has to leave there too, or the sheet keeps emitting its rule. Nothing is
   * ever removed during a build, so this stays at zero and the decoder never rebuilds.
   */
  removals = 0

  /**
   * Reconcile one file-owner lane to the order of its current source inventory.
   *
   * Long-lived consumers normally retain an owner's first-seen rank, which is the right
   * default for an isolated replacement: editing one file must not move it. A source
   * inventory can itself change, though. Adding a file between two existing members must put
   * its contribution between theirs, and deleting then recreating it must restore that same
   * clean-build position rather than appending it at the end.
   *
   * Paths without a contribution are ranked too. That is the staging half: a consumer calls
   * this before committing affected contributions, so asynchronous discovery or a newly added
   * source cannot decide aggregate Set/Map insertion order by completion time. Existing owners
   * are repaired through each collection's indexed rank updater; no unrelated owner or key is
   * scanned.
   *
   * @internal Watch/build consumers provide a complete deterministic inventory for `kind`.
   */
  reconcileFileOwnerOrder = (kind: FileOwnerKind, paths: readonly string[]) => {
    const seen = new Set<string>()
    const entries: Array<{ owner: string; rank: OrderOwnerRank | undefined }> = []
    for (const path of paths) {
      const owner = ownerKey(kind, path)
      if (seen.has(owner)) continue
      seen.add(owner)
      entries.push({ owner, rank: this.ownerOrderRanks.get(owner) })
    }

    const updates = new Map<string, OrderOwnerRank>()
    const rankAt = (index: number, sequence: number) => {
      const entry = entries[index]!
      updates.set(entry.owner, {
        phase: 0,
        sequence,
        subSequence: 0,
        serial: entry.rank?.serial ?? this.nextOwnerOrderSerial++,
      })
    }

    // Existing members are stable anchors. New members receive labels in the gaps, so adding
    // one file does not renumber or revisit every later owner in a thousand-file inventory.
    // A consumer which stages a cold inventory reaches the all-new branch and seeds every
    // label before the first contribution is committed.
    let previous = -Infinity
    let anchorsOrdered = true
    for (const { rank } of entries) {
      if (!rank) continue
      if (rank.phase !== 0 || rank.sequence <= previous) {
        anchorsOrdered = false
        break
      }
      previous = rank.sequence
    }

    if (anchorsOrdered) {
      let index = 0
      while (index < entries.length) {
        if (entries[index]!.rank) {
          index++
          continue
        }

        const start = index
        while (index < entries.length && !entries[index]!.rank) index++
        const count = index - start
        const lower = start > 0 ? entries[start - 1]!.rank?.sequence : undefined
        const upper = index < entries.length ? entries[index]!.rank?.sequence : undefined

        if (lower !== undefined && upper !== undefined) {
          const step = (upper - lower) / (count + 1)
          // IEEE doubles provide hundreds of insertions in any ordinary gap. If an extreme
          // edit history exhausts one, fall back below to a complete deterministic relabel.
          if (!(step > 0) || lower + step === lower || upper - step === upper) {
            anchorsOrdered = false
            break
          }
          for (let offset = 0; offset < count; offset++) rankAt(start + offset, lower + step * (offset + 1))
        } else if (lower !== undefined) {
          for (let offset = 0; offset < count; offset++) rankAt(start + offset, lower + offset + 1)
        } else if (upper !== undefined) {
          for (let offset = 0; offset < count; offset++) rankAt(start + offset, upper - count + offset)
        } else {
          for (let offset = 0; offset < count; offset++) rankAt(start + offset, offset)
        }
      }
    }

    if (!anchorsOrdered) {
      updates.clear()
      entries.forEach((_, index) => rankAt(index, index))
    }

    const maxSequence = Math.max(
      -1,
      ...entries.map(({ rank, owner }) => updates.get(owner)?.sequence ?? rank!.sequence),
    )
    // A later unranked file remains after the explicitly ranked inventory until the next
    // reconciliation gives it a concrete position.
    this.nextFileOwnerOrderRank = Math.max(this.nextFileOwnerOrderRank, Math.ceil(maxSequence) + 1)
    if (!updates.size) return

    const collectionUpdates = new Map<OrderableCollection, Map<string, OrderOwnerRank>>()
    updates.forEach((rank, owner) => {
      this.ownerOrderCollections.get(owner)?.forEach((collection) => {
        const ranks = collectionUpdates.get(collection) ?? new Map<string, OrderOwnerRank>()
        ranks.set(owner, rank)
        collectionUpdates.set(collection, ranks)
      })
    })

    let changed = false
    collectionUpdates.forEach((ranks, collection) => {
      const result = collection.updateOwnerRanks(ranks)
      changed ||= result.changed
      this.ownerOrderWork += result.work
    })
    updates.forEach((rank, owner) => this.ownerOrderRanks.set(owner, rank))
    if (changed) this.ownerOrderRevision++
  }

  /**
   * Attribute everything `fn` encodes to `owner`, replacing whatever it encoded last time.
   *
   * This is what keeps a long-lived context from growing forever. The encoder only ever
   * accumulated, so a dev server's stylesheet kept every class every version of every edited
   * file had ever produced -- each save added the new atoms and left the old ones behind, for
   * the life of the process.
   *
   * Retain-then-release, rather than a diff of the two scopes. A key held by both readings
   * goes 1 -> 2 -> 1 and is never briefly absent, which matters because "absent" is what
   * deletes it; and both halves cost the size of *this owner's* contribution, never the size
   * of the project.
   *
   * Anything encoded outside an owner is pinned instead (see `Refs.pin`) -- `staticCss`
   * safelists, a restored encoder dump, a `RuleProcessor` call. Those answer to config rather
   * than to a file, so no file may take them away.
   *
   * Reconciled in a `finally`: a parse that throws has still put hashes in the collections,
   * and leaving them unattributed would make them permanent. The owner ends up holding what
   * the partial parse reached, and the next successful read replaces it.
   */
  withOwner = <T>(kind: FileOwnerKind, path: string, fn: () => T): T => {
    return this.withOwnerKey(ownerKey(kind, path), fn)
  }

  private withOwnerKey = <T>(owner: string, fn: () => T): T => {
    // An outer owner is already accounting for this. Nesting arises where an entry point that
    // scopes a file calls another that would scope it again, and double-counting would leave
    // the inner owner holding hashes that only its own next parse could release.
    if (this.activeOwner !== null) return fn()

    const previous = this.owners.get(owner)
    this.ensureScopeOrderOwner(owner, previous)

    const parent = this.activeScope
    const scope = createScope()
    this.activeScope = scope
    this.activeOwner = owner

    try {
      return fn()
    } finally {
      this.activeScope = parent
      this.activeOwner = null
      if (parent) mergeScope(parent, scope)

      const orderPlan = this.planScopeOrder(owner, scope, previous)
      const transitionPayloadPlan = this.planViewTransitionPayloads(owner, scope, previous)
      const recipeOwnerOrderPlan = this.planRecipeOwnerOrder(scope, previous)
      this.owners.set(owner, scope)
      this.retainScope(scope)
      if (previous) this.releaseScope(previous)
      orderPlan()
      transitionPayloadPlan()
      recipeOwnerOrderPlan()
    }
  }

  private planScopeOrder = (owner: string, scope: EncoderScope, previous: EncoderScope | undefined) => {
    const plans: Array<() => OrderUpdateResult> = []
    const ensurePlans: Array<() => void> = []
    const cleanupPlans: Array<() => void> = []
    const plan = (collection: Set<string> | Map<string, unknown>, desired: Iterable<string>, refs: Refs) => {
      this.ensureOrderOwner(collection, owner)
      const values = Array.from(desired)
      plans.push(() => (collection as OrderableCollection).replaceOwnerKeys(owner, values, refs.isPinned))
    }

    plan(this.atomic, scope.atomic, this.atomicRefs)

    const recipeNames = new Set([...scope.recipe_order.keys(), ...(previous?.recipe_order.keys() ?? [])])
    for (const name of recipeNames) {
      const hashes = scope.recipe_order.get(name) ?? []
      const set = this.recipes.get(name)
      if (set) plan(set, hashes, this.recipeRefs)
      else {
        ensurePlans.push(() => {
          const created = this.recipes.get(name)
          if (created) this.ensureOrderOwner(created, owner)
        })
        const values = Array.from(hashes)
        plans.push(
          () =>
            (this.recipes.get(name) as OrderableSet | undefined)?.replaceOwnerKeys(
              owner,
              values,
              this.recipeRefs.isPinned,
            ) ?? { changed: false, work: 0 },
        )
      }
      if (!scope.recipe_order.has(name) && set) cleanupPlans.push(() => this.removeOrderOwner(set, owner))
    }
    plan(this.recipes, scope.recipe_order.keys(), this.recipeEntryRefs)
    plan(this.recipes_base, scope.recipes_base, this.recipeBaseRefs)
    plan(this.compound_variants, scope.compound_variants ?? [], this.compoundRefs)
    plan(this.view_transitions, scope.view_transitions ?? [], this.viewTransitionRefs)
    // Kept in lock-step with the public transition map even though only capture reads it.
    plan(this.viewTransitionInputs, scope.view_transitions ?? [], this.viewTransitionRefs)
    plan(this.observedRecipes, scope.observed_recipes ?? [], this.observedRefs)

    return () => {
      ensurePlans.forEach((apply) => apply())
      let changed = false
      plans.forEach((apply) => {
        const result = apply()
        changed ||= result.changed
        this.ownerOrderWork += result.work
      })
      cleanupPlans.forEach((apply) => apply())
      if (changed) this.ownerOrderRevision++
    }
  }

  /**
   * Reconcile exact view-transition values separately from their ordered Map keys.
   *
   * The key's earliest owner occurrence determines where it iterates. Its value follows the
   * latest live owner, matching clean `Map.set` processing. Each class has an indexed maximum
   * heap, so replacing or releasing one owner never scans unrelated owners or even all owners
   * that share the class.
   */
  private planViewTransitionPayloads = (owner: string, scope: EncoderScope, previous: EncoderScope | undefined) => {
    const next = scope.view_transition_payloads ?? new Map<string, ViewTransitionPayload>()
    const before = previous?.view_transition_payloads ?? new Map<string, ViewTransitionPayload>()
    const classNames = new Set([
      ...(previous?.view_transitions ?? []),
      ...(scope.view_transitions ?? []),
      ...before.keys(),
      ...next.keys(),
    ])

    return () => {
      const rank = this.ownerOrderRanks.get(owner)!
      const winners: Array<{
        className: string
        previous: ViewTransitionPayload | undefined
        next: ViewTransitionPayload | undefined
      }> = []
      classNames.forEach((className) => {
        this.ownerPayloadWork++
        const index = this.viewTransitionPayloads.get(className) ?? new ViewTransitionPayloadIndex()
        const previousWinner = index.winner
        const payload = next.get(className)
        if (payload) this.ownerPayloadWork += index.upsert(owner, rank, payload)
        else this.ownerPayloadWork += index.remove(owner)

        const winner = index.winner
        if (index.size || index.isPinned) this.viewTransitionPayloads.set(className, index)
        else this.viewTransitionPayloads.delete(className)
        winners.push({ className, previous: previousWinner, next: winner })
      })
      this.applyViewTransitionPayloadWinners(winners)
    }
  }

  private pinViewTransitionPayload = (className: string, payload: ViewTransitionPayload) => {
    const index = this.viewTransitionPayloads.get(className) ?? new ViewTransitionPayloadIndex()
    this.assertCompatibleViewTransitionPayload(className, payload, index.winner)
    const previous = index.winner
    index.pin(payload)
    this.viewTransitionPayloads.set(className, index)
    // A pin is an immutable, ownerless source. File owners remain capturable/refcounted but
    // cannot change its aggregate bytes; a later explicit ownerless write may replace the pin.
    this.applyViewTransitionPayloadWinners([{ className, previous, next: index.winner }])
  }

  /**
   * Install exact aggregate transition bytes and invalidate accumulated decoder results once.
   *
   * No key left a collection, so this deliberately advances the semantic/order generation
   * rather than `removals`. Inputs are capture metadata; normalized slots are the emitted bytes,
   * and only an exact slot value/order change requires a decoder rebuild.
   */
  private applyViewTransitionPayloadWinners = (
    winners: ReadonlyArray<{
      className: string
      previous: ViewTransitionPayload | undefined
      next: ViewTransitionPayload | undefined
    }>,
  ) => {
    let changed = false
    winners.forEach(({ className, previous, next }) => {
      if (!next) return
      this.view_transitions.set(className, next.slots)
      if (next.input) this.viewTransitionInputs.set(className, next.input)
      else this.viewTransitionInputs.delete(className)
      if (previous && !sameJson(previous.slots, next.slots)) changed = true
    })
    if (changed) this.ownerOrderRevision++
  }

  private assertCompatibleViewTransitionPayload = (
    className: string,
    payload: ViewTransitionPayload,
    existing = this.viewTransitionPayloads.get(className)?.winner,
  ) => {
    if (existing && !sameViewTransitionSemantics(existing, payload)) {
      throw new StyleContributionError(
        `view transition ${JSON.stringify(className)} collides with a different semantic payload`,
      )
    }
  }

  private ensureScopeOrderOwner = (owner: string, scope: EncoderScope | undefined) => {
    this.ensureOrderOwner(this.atomic, owner)
    this.ensureOrderOwner(this.recipes, owner)
    this.ensureOrderOwner(this.recipes_base, owner)
    this.ensureOrderOwner(this.compound_variants, owner)
    this.ensureOrderOwner(this.view_transitions, owner)
    this.ensureOrderOwner(this.viewTransitionInputs, owner)
    this.ensureOrderOwner(this.observedRecipes, owner)
    scope?.recipe_order.forEach((_, name) => {
      const set = this.recipes.get(name)
      if (set) this.ensureOrderOwner(set, owner)
    })
  }

  /** Keep recipe-owned atom blocks grouped by their observing file and local encounter order. */
  private planRecipeOwnerOrder = (scope: EncoderScope, previous: EncoderScope | undefined) => {
    const names = new Set([...(scope.observed_recipes ?? []), ...(previous?.observed_recipes ?? [])])

    return () => {
      const updates = new Map<string, OrderOwnerRank>()
      names.forEach((name) => {
        const effective = (this.observedRecipes as OrderableSet).getEffectiveOwner(name)
        if (!effective) return
        const recipeOwner = ownerKey('recipe', name)
        const existing = this.ownerOrderRanks.get(recipeOwner)
        const rank: OrderOwnerRank = {
          phase: 1,
          sequence: effective.rank.sequence,
          subSequence: effective.order,
          serial: existing?.serial ?? this.nextOwnerOrderSerial++,
        }
        if (!existing || compareOrderOwnerRanks(existing, rank) !== 0) updates.set(recipeOwner, rank)
      })
      if (!updates.size) return

      const collectionUpdates = new Map<OrderableCollection, Map<string, OrderOwnerRank>>()
      updates.forEach((rank, owner) => {
        this.ownerOrderCollections.get(owner)?.forEach((collection) => {
          const ranks = collectionUpdates.get(collection) ?? new Map<string, OrderOwnerRank>()
          ranks.set(owner, rank)
          collectionUpdates.set(collection, ranks)
        })
      })
      let changed = false
      collectionUpdates.forEach((ranks, collection) => {
        const result = collection.updateOwnerRanks(ranks)
        changed ||= result.changed
        this.ownerOrderWork += result.work
      })
      updates.forEach((rank, owner) => this.ownerOrderRanks.set(owner, rank))
      if (changed) this.ownerOrderRevision++
    }
  }

  private ensureOrderOwner = (collection: Set<string> | Map<string, unknown>, owner: string) => {
    let rank = this.ownerOrderRanks.get(owner)
    if (rank === undefined) {
      const recipeOwner = owner.startsWith('recipe:')
      rank = {
        phase: recipeOwner ? 1 : 0,
        sequence: recipeOwner ? Number.MAX_SAFE_INTEGER : this.nextFileOwnerOrderRank++,
        subSequence: recipeOwner ? this.nextRecipeOwnerOrderRank++ : 0,
        serial: this.nextOwnerOrderSerial++,
      }
      this.ownerOrderRanks.set(owner, rank)
    }
    const orderable = collection as OrderableCollection
    if (!orderable.ensureOwner(owner, rank)) return
    const collections = this.ownerOrderCollections.get(owner) ?? new Set<OrderableCollection>()
    collections.add(orderable)
    this.ownerOrderCollections.set(owner, collections)
  }

  private removeOrderOwner = (collection: Set<string> | Map<string, unknown>, owner: string) => {
    const orderable = collection as OrderableCollection
    if (!orderable.removeOwner(owner)) return
    const collections = this.ownerOrderCollections.get(owner)
    collections?.delete(orderable)
    if (collections?.size === 0) this.ownerOrderCollections.delete(owner)
  }

  private removeAllOrderOwners = (owner: string) => {
    this.ownerOrderCollections.get(owner)?.forEach((collection) => collection.removeOwner(owner))
    this.ownerOrderCollections.delete(owner)
    this.ownerOrderRanks.delete(owner)
  }

  private pinOrderKey = (collection: Set<string> | Map<string, unknown>, key: string) => {
    this.ownerOrderWork += (collection as OrderableCollection).pinKey(key)
  }

  private expectedRecipeBases = (
    name: string,
    config: RecipeConfig | SlotRecipeDefinition,
    kind: InlineRecipeContribution['kind'] = 'slots' in config ? 'sva' : 'cva',
  ) => {
    const result = new Map<string, Set<string>>()
    if (kind === 'sva') {
      const slotConfig = config as SlotRecipeDefinition
      for (const slot of slotConfig.slots ?? []) {
        const value = slotConfig.base?.[slot]
        if (!value) continue
        const key = this.context.recipes.getSlotKey(name, slot)
        const hashes = new Set<string>()
        this.hashStyleObject(hashes, value, { recipe: name, slot })
        result.set(key, hashes)
      }
    } else if (config.base) {
      const hashes = new Set<string>()
      this.hashStyleObject(hashes, config.base, { recipe: name })
      result.set(name, hashes)
    }
    return result
  }

  private splitRecipeKey = (key: string): [string, string | undefined] => {
    if (this.context.recipes.getConfig(key)) return [key, undefined]
    const separator = this.context.recipes.slotSeparator
    let index = key.lastIndexOf(separator)
    while (index > 0) {
      const name = key.slice(0, index)
      if (this.context.recipes.getConfig(name)) return [name, key.slice(index + separator.length)]
      index = key.lastIndexOf(separator, index - 1)
    }
    return [key, undefined]
  }

  private expectedVariantHashes = (name: string, config: RecipeConfig | SlotRecipeDefinition) => {
    const hashes = new Set<string>()
    for (const [variant, values] of Object.entries(config.variants ?? {})) {
      for (const value of Object.keys(values ?? {})) {
        this.hashStyleObject(hashes, { [variant]: value }, { recipe: name, variants: true })
      }
    }
    return hashes
  }

  private expectedCompoundHashes = (name: string, config: RecipeConfig | SlotRecipeDefinition) => {
    const hashes = new Set<string>()
    const compounds = (config.compoundVariants ?? []) as Array<Record<string, any>>
    const hash = (values: Array<Record<string, any>>, slot?: string) => {
      values.forEach((compound, index) => {
        if (!compound?.css) return
        this.hashStyleObject(hashes, { [COMPOUND_VARIANT]: index }, { recipe: name, slot, variants: true })
      })
    }
    if ('slots' in config && Array.isArray(config.slots) && config.slots.length) {
      config.slots.forEach((slot: string) => hash(getSlotCompoundVariant(compounds as Array<{ css: any }>, slot), slot))
    } else {
      hash(compounds)
    }
    return hashes
  }

  private expectedRecipeAtoms = (config: RecipeConfig | SlotRecipeDefinition) => {
    const hashes = new Set<string>()
    const slots = 'slots' in config && Array.isArray(config.slots) && config.slots.length ? config.slots : undefined
    const take = (value: unknown) => {
      if (!slots) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          this.hashStyleObject(hashes, value as StyleResultObject)
        }
        return
      }
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      for (const slot of slots) {
        const styles = (value as Dict)[slot]
        if (styles && typeof styles === 'object' && !Array.isArray(styles)) this.hashStyleObject(hashes, styles)
      }
    }
    take(config.base)
    for (const values of Object.values(config.variants ?? {})) {
      for (const value of Object.values(values ?? {})) take(value)
    }
    for (const compound of config.compoundVariants ?? []) take((compound as { css?: unknown })?.css)
    return hashes
  }

  /** Drop everything an owner contributed. Its keys leave the collections with it. */
  releaseOwner = (owner: string) => {
    const scope = this.owners.get(owner)
    if (scope) {
      const empty = createScope()
      this.ensureScopeOrderOwner(owner, scope)
      const orderPlan = this.planScopeOrder(owner, empty, scope)
      const transitionPayloadPlan = this.planViewTransitionPayloads(owner, empty, scope)
      const recipeOwnerOrderPlan = this.planRecipeOwnerOrder(empty, scope)
      this.owners.delete(owner)
      this.releaseScope(scope)
      orderPlan()
      transitionPayloadPlan()
      recipeOwnerOrderPlan()
    }
    this.removeAllOrderOwners(owner)
  }

  /**
   * Drop everything a file contributed, whichever entry point read it.
   *
   * The deletion half of the same problem: nothing re-parses a file that is gone, so without
   * this its rules outlive it exactly as an edited file's old rules used to.
   */
  releaseFile = (filePath: string) => {
    for (const kind of FILE_OWNER_KINDS) this.releaseOwner(ownerKey(kind, filePath))
  }

  private retainScope = (scope: EncoderScope) => {
    scope.atomic.forEach(this.atomicRefs.retain)
    scope.recipe_order.forEach((hashes, name) => {
      this.recipeEntryRefs.retain(name)
      hashes.forEach(this.recipeRefs.retain)
    })
    scope.recipes_base.forEach(this.recipeBaseRefs.retain)
    scope.compound_variants?.forEach(this.compoundRefs.retain)
    scope.view_transitions?.forEach(this.viewTransitionRefs.retain)
    scope.observed_recipes?.forEach(this.observedRefs.retain)
    scope.inline_recipes?.forEach((_, name) => this.inlineRecipeRefs.retain(name))
  }

  private releaseScope = (scope: EncoderScope) => {
    scope.atomic.forEach((hash) => {
      if (this.atomicRefs.release(hash)) this.drop(this.atomic.delete(hash))
    })

    scope.recipe_order.forEach((hashes, name) => {
      const set = this.recipes.get(name)
      hashes.forEach((hash) => {
        if (this.recipeRefs.release(hash)) this.drop(set?.delete(hash))
      })
    })

    scope.recipes_base.forEach((key) => {
      if (this.recipeBaseRefs.release(key)) this.drop(this.recipes_base.delete(key))
    })

    scope.compound_variants?.forEach((name) => {
      if (!this.compoundRefs.release(name)) return
      this.compound_variants.delete(name)
      this.compoundHashes.delete(name)
    })

    scope.view_transitions?.forEach((className) => {
      if (!this.viewTransitionRefs.release(className)) return
      this.viewTransitionInputs.delete(className)
      this.drop(this.view_transitions.delete(className))
    })

    scope.observed_recipes?.forEach((name) => {
      if (!this.observedRefs.release(name)) return
      this.observedRecipes.delete(name)
      this.atomizedRecipes.delete(name)
      // The atoms `atomizeObservedRecipes` interned for it. Held by the recipe rather than by
      // the files that use it, because that pass runs once per recipe and after extraction.
      this.releaseOwner(ownerKey('recipe', name))
    })

    scope.inline_recipes?.forEach((recipe, name) => {
      if (this.inlineRecipeRefs.release(name) && this.context.recipes.unregisterInline(name, recipe.config)) {
        this.inlineRecipeRevision++
      }
    })

    scope.recipe_order.forEach((_, name) => {
      if (!this.recipeEntryRefs.release(name)) return
      const set = this.recipes.get(name)
      if (set && !set.size) this.recipes.delete(name)
    })
  }

  private drop = (removed: boolean | undefined) => {
    if (removed) this.removals++
  }

  /**
   * Note that the active call encoded `key`.
   *
   * With no owner recording, the key is pinned: nothing put it there on a file's behalf, so
   * no file's next parse may take it away.
   */
  private ownRecipeBase = (key: string, pinned = false) => {
    if (pinned || this.activeOwner === null) {
      this.recipeBaseRefs.pin(key)
      this.pinOrderKey(this.recipes_base, key)
    }
    if (!pinned) this.activeScope?.recipes_base.add(key)
  }

  private processRecipeBaseValue = (
    key: string,
    value: StyleResultObject,
    baseEntry: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
    pinned = false,
  ) => {
    this.ownRecipeBase(key, pinned)
    const existing = this.recipes_base.get(key)
    if (!existing) {
      this.hashStyleObject(getOrCreateSet(this.recipes_base, key), value, baseEntry)
      return
    }

    const previousOwnsKey =
      !pinned &&
      this.activeOwner !== null &&
      this.owners.get(this.activeOwner)?.recipes_base.has(key) === true &&
      this.recipeBaseRefs.isSoleOwner(key)
    if (!previousOwnsKey) return

    const expected = new Set<string>()
    this.hashStyleObject(expected, value, baseEntry)
    if (sameOrdered(existing, expected)) return
    this.recipes_base.set(key, expected)
    this.ownerOrderRevision++
  }

  private ownCompound = (name: string) => {
    if (this.activeOwner === null) {
      this.compoundRefs.pin(name)
      this.recipeEntryRefs.pin(name)
      this.pinOrderKey(this.compound_variants, name)
      this.pinOrderKey(this.recipes, name)
    }
    const scope = this.activeScope
    if (scope) (scope.compound_variants ??= new Set()).add(name)
  }

  /** Record collection order without exposing synthetic compounds to class filtering. */
  private ownRecipeHashOrder = (name: string, hashes?: Iterable<string>) => {
    const scope = this.activeScope
    if (!scope) return
    const order = getOrCreateSet(scope.recipe_order, name)
    if (hashes) for (const hash of hashes) order.add(hash)
  }

  private ownInlineRecipe = (
    name: string,
    kind: InlineRecipeContribution['kind'],
    config: InlineRecipeContribution['config'],
    identitySlots: string[] | null,
  ) => {
    if (this.activeOwner === null) this.inlineRecipeRefs.pin(name)
    const scope = this.activeScope
    if (!scope) return
    const recipes = (scope.inline_recipes ??= new Map())
    if (!recipes.has(name)) recipes.set(name, { kind, config, identitySlots })
  }

  /**
   * Normalize one inline registration and refresh same-name state only when this owner is
   * the sole holder of the previous config. Two live files cannot give one class name two
   * meanings, so that case is rejected instead of becoming traversal-order dependent.
   */
  private registerInlineRecipe = (
    name: string,
    kind: InlineRecipeContribution['kind'],
    config: RecipeConfig | SlotRecipeDefinition,
    identitySlots: string[] | null,
  ) => {
    const scoped = this.activeScope?.inline_recipes?.get(name)
    if (
      scoped &&
      (scoped.kind !== kind || !sameJson(scoped.config, config) || !sameJson(scoped.identitySlots, identitySlots))
    ) {
      throw new StyleContributionError(
        `inline recipe ${JSON.stringify(name)} has conflicting declarations in one owner`,
      )
    }
    if (Object.hasOwn(this.context.recipes.config, name)) {
      throw new StyleContributionError(`inline recipe ${JSON.stringify(name)} conflicts with a configured recipe`)
    }
    const existing = this.context.recipes.getInlineConfig(name)
    const changed = existing !== undefined && !sameJson(existing, config)
    if (existing !== undefined && !changed) {
      this.ownInlineRecipe(name, kind, config, identitySlots)
      return
    }
    if (changed && !this.canReplaceInlineRecipe(name, existing)) {
      throw new StyleContributionError(`inline recipe ${JSON.stringify(name)} conflicts with another owner`)
    }

    // Preparation runs the complete normalization against detached maps. A malformed config
    // therefore throws before any shared recipe registry or encoder collection is changed.
    const prepared = this.context.recipes.prepareInline(name, config)
    for (const key of prepared.keys) {
      const keyOwner = this.context.recipes.getInlineKeyOwner(key)
      if (keyOwner !== undefined && keyOwner !== name) {
        throw new StyleContributionError(
          `inline recipe ${JSON.stringify(name)} conflicts with normalized unit ${JSON.stringify(key)}`,
        )
      }
    }
    for (const className of prepared.classNames.values()) {
      const classOwner = this.context.recipes.getInlineClassOwner(className)
      if (classOwner !== undefined && classOwner !== name) {
        throw new StyleContributionError(
          `inline recipe ${JSON.stringify(name)} conflicts with emitted class ${JSON.stringify(className)}`,
        )
      }
    }
    this.context.recipes.commitInline(prepared)
    this.ownInlineRecipe(name, kind, config, identitySlots)
    if (changed) this.refreshInlineRecipe(name, config)
  }

  private canReplaceInlineRecipe = (
    name: string,
    existing: RecipeConfig | SlotRecipeDefinition,
    owner: string | null = this.activeOwner,
  ) => {
    if (this.inlineRecipeRefs.isPinned(name)) return false
    if (!this.inlineRecipeRefs.hasOwner(name)) return true
    if (owner === null || !this.inlineRecipeRefs.isSoleOwner(name)) return false
    const previous = this.owners.get(owner)?.inline_recipes?.get(name)
    return !!previous && sameJson(previous.config, existing)
  }

  /** Reconcile payloads whose key is stable even though an inline config changed. */
  private refreshInlineRecipe = (
    name: string,
    config: RecipeConfig | SlotRecipeDefinition,
    replaceAtomizedOwner = false,
  ) => {
    const expectedBases = this.expectedRecipeBases(name, config)
    for (const [key, hashes] of expectedBases) {
      const existing = this.recipes_base.get(key)
      if (existing && !sameOrdered(existing, hashes)) this.recipes_base.set(key, hashes)
    }

    if (this.compound_variants.has(name)) {
      const current = this.compoundHashes.get(name) ?? new Set<string>()
      const expected = this.expectedCompoundHashes(name, config)
      const recipes = getOrCreateOrderedSet(this.recipes, name)
      current.forEach((hash) => {
        const removed = recipes.delete(hash)
        if (!expected.has(hash)) this.drop(removed)
      })
      this.compoundHashes.delete(name)
    }

    // Decoder caches are keyed by the stable recipe class, while their styles live in the
    // refreshed Recipes registry. One monotonic invalidation makes the next collect rebuild.
    this.removals++
    this.inlineRecipeRevision++
    if (!replaceAtomizedOwner && this.atomizedRecipes.delete(name)) this.clearOwnerScope(ownerKey('recipe', name))
  }

  /** Empty an owner whose semantic position must survive until its still-observed recipe is rebuilt. */
  private clearOwnerScope = (owner: string) => {
    const previous = this.owners.get(owner)
    if (!previous) return
    const scope = createScope()
    this.ensureScopeOrderOwner(owner, previous)
    const orderPlan = this.planScopeOrder(owner, scope, previous)
    this.owners.set(owner, scope)
    this.retainScope(scope)
    this.releaseScope(previous)
    orderPlan()
  }

  private observeRecipe = (name: string) => {
    this.observedRecipes.add(name)
    if (this.activeOwner === null) {
      this.observedRefs.pin(name)
      this.pinOrderKey(this.observedRecipes, name)
    }
    const scope = this.activeScope
    if (scope) (scope.observed_recipes ??= new Set()).add(name)
  }

  constructor(private context: Pick<Context, 'isValidProperty' | 'recipes' | 'patterns' | 'conditions' | 'utility'>) {}

  filterStyleProps = (props: Dict): Dict => {
    return filterProps(this.context.isValidProperty, props)
  }

  clone = () => {
    return new StyleEncoder(this.context)
  }

  isEmpty = () => {
    return (
      !this.atomic.size &&
      !this.recipes.size &&
      !this.compound_variants.size &&
      !this.recipes_base.size &&
      !this.view_transitions.size
    )
  }

  get results() {
    return {
      atomic: this.atomic,
      recipes: this.recipes,
      recipes_base: this.recipes_base,
      view_transitions: this.view_transitions,
    }
  }
  /**
   * Hashes a style object and adds the resulting hashes to a set.
   * @param set - The set to add the resulting hashes to.
   * @param obj - The style object to hash.
   * @param baseEntry - An optional base style entry to use when hashing the style object.
   */
  hashStyleObject = (
    set: Set<string>,
    obj: ResultItem['data'][number],
    baseEntry?: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
  ) => {
    const isCondition = this.context.conditions.isCondition
    const traverseOptions = { separator: StyleEncoder.conditionSeparator }

    // Is the final (leading to a raw value, not an object) property a condition ?
    // mx: { base: { p: 4, _hover: 5 } }
    //                            ^^^
    let prop = ''
    let prevProp = ''

    // { mx: 4 } => { marginX: 4 }
    const isRecipe = !!baseEntry?.variants
    const normalized = normalizeStyleObject(obj, this.context, !isRecipe)

    traverse(
      normalized,
      ({ key, value: rawValue, path }) => {
        if (rawValue === undefined) {
          return
        }

        // we don't want to extract and generate invalid CSS for urls
        if (urlRegex.test(rawValue)) {
          return
        }

        const value = rawValue

        prop = key

        // { _hover: { ... } }
        //   ^^^^^^
        if (isCondition(key)) {
          // { _hover: { ... } }
          //           ^^^^^^^
          if (isObjectOrArray(value)) {
            return
          }

          // { _hover: { base: 4 } }
          //             ^^^^^^^
          prop = prevProp
        } else if (isObjectOrArray(value)) {
          // { mx: { base: 4 } }
          //       ^^^^^^^^^^^
          prevProp = prop
          return
        }
        const resolvedCondition = getResolvedCondition(path, isCondition)

        const hashed = hashStyleEntry(Object.assign(baseEntry ?? {}, { prop, value, cond: resolvedCondition }))
        set.add(hashed)

        prevProp = prop
      },
      traverseOptions,
    )
  }

  processAtomic = (styles: StyleResultObject) => {
    // Hashed into a local set first, so this call's contribution stays separable from whatever
    // the encoder already holds. Insertion order into `atomic` is unchanged by the detour: a
    // hash already there does not move, and a new one still arrives in traversal order.
    const set = new Set<string>()
    this.hashStyleObject(set, styles)

    const scope = this.activeScope
    const unowned = this.activeOwner === null

    set.forEach((hash) => {
      this.atomic.add(hash)
      if (scope) scope.atomic.add(hash)
      if (unowned) {
        this.atomicRefs.pin(hash)
        this.pinOrderKey(this.atomic, hash)
      }
    })
  }

  /**
   * Record a `viewTransition({ ... })` bag.
   *
   * The class is derived from the options alone, by the same function the generated
   * runtime calls, so the class the build emits CSS for is the class the call returns.
   */
  processViewTransition = (options: unknown) => {
    if (!options || typeof options !== 'object') return

    const input: StyleResultObject = {}
    for (const slot of viewTransitionSlots) {
      const value = (options as StyleResultObject)[slot]
      // Nullish is dropped on the hashing side too, so skipping it here cannot make the
      // build disagree with the runtime about which class this call returns.
      if (value == null) continue
      // The emit path serializes a slot body whole rather than atomizing it, so it never
      // reaches the normalizing the atomic path does on the way in — which is where a
      // shorthand is renamed to its longhand and a nullish leaf is dropped.
      input[slot] = value
    }

    if (!Object.keys(input).length) return

    // The caller retains its object. Snapshot before storing or normalizing it so a later
    // mutation cannot make the captured payload disagree with the already-derived class.
    const stableInput = snapshotContributionObject(input) as StyleResultObject
    const slots: StyleResultObject = {}
    for (const slot of viewTransitionSlots) {
      if (Object.hasOwn(stableInput, slot)) {
        slots[slot] = normalizeStyleObject(stableInput[slot] as StyleResultObject, this.context)
      }
    }

    const className = viewTransitionClassName(stableInput, this.context.utility.prefix)
    const payload = { input: stableInput, slots } satisfies ViewTransitionPayload
    const scopedPayload = this.activeScope?.view_transition_payloads?.get(className)
    this.assertCompatibleViewTransitionPayload(className, payload, scopedPayload)

    if (this.activeOwner === null) {
      this.viewTransitionRefs.pin(className)
      this.pinViewTransitionPayload(className, payload)
      this.pinOrderKey(this.view_transitions, className)
      this.pinOrderKey(this.viewTransitionInputs, className)
    } else {
      // Staged so the key exists when the owner-order plan runs; the payload plan below the
      // owner transaction restores the true latest/pinned winner and sends one notification.
      this.view_transitions.set(className, slots)
      this.viewTransitionInputs.set(className, stableInput)
    }
    const scope = this.activeScope
    if (scope) {
      const classes = (scope.view_transitions ??= new Set())
      const payloads = (scope.view_transition_payloads ??= new Map())
      classes.add(className)
      payloads.set(className, payload)
    }
  }

  processStyleProps = (styleProps: StyleProps) => {
    const processFn = this.processAtomic
    const styles = this.filterStyleProps(styleProps)
    const rest = {} as Dict

    for (const [key, value] of Object.entries(styles)) {
      // css and *Css props (e.g. inputCss, wrapperCss) are style objects
      if (key === 'css' || key.endsWith('Css')) {
        if (Array.isArray(value)) {
          value.forEach((style) => processFn(style))
        } else if (value) {
          processFn(value)
        }
      } else {
        rest[key] = value
      }
    }

    processFn(rest)
  }

  processConfigSlotRecipeBase = (recipeName: string, config: SlotRecipeDefinition, pinned = false) => {
    config.slots.forEach((slot) => {
      const recipeKey = this.context.recipes.getSlotKey(recipeName, slot)

      const slotBase = config.base?.[slot]
      if (!slotBase) return

      this.processRecipeBaseValue(recipeKey, slotBase, { recipe: recipeName, slot }, pinned)
    })
  }

  processConfigSlotRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config || !Recipes.isSlotRecipeDefinition(config)) return

    // process base styles
    this.processConfigSlotRecipeBase(recipeName, config)

    // process variants
    const computedVariants = Object.assign({}, config.defaultVariants, variants)
    this.hashVariants(recipeName, computedVariants, { recipe: recipeName, variants: true })

    // See `processConfigRecipe`: a slot recipe names a class per slot, so an axis the call site
    // left dynamic leaves *every* slot short rather than one.
    this.hashUnresolvedVariants(recipeName, config.variants, unresolved, { recipe: recipeName, variants: true })

    // process compound variants
    if (!config.compoundVariants) return
    // Recorded before the early return, for the same reason the base is: the block belongs to
    // this call's result whether or not this call is the one that hashed it.
    this.ownCompound(recipeName)
    if (this.compound_variants.has(recipeName)) {
      this.ownRecipeHashOrder(recipeName, this.compoundHashes.get(recipeName))
      return
    }
    this.compound_variants.add(recipeName)
    this.hashCompoundVariants(
      recipeName,
      config.compoundVariants as Array<Record<string, any>>,
      config.slots as string[],
    )
  }

  /**
   * Hash a recipe's compound variants, one synthetic variant per compound.
   *
   * Deliberately *not* recorded on the active scope, unlike every other hash here. A
   * compound rule selects on the variant classes the element already carries —
   * `.btn--size_sm.btn--tone_a` — so it contributes no class of its own, and `scope` is
   * what `filterClassNames` reads to answer "which classes does this call return". Putting
   * it there would hand the runtime a class no element ever gets, and the fold would bake
   * that into a literal.
   *
   * Slot recipes hash per slot, through the same `getSlotCompoundVariant` that `normalize`
   * used. It filters out compounds that do not touch a slot, so both sides have to walk the
   * filtered list or the indices they key on stop lining up.
   */
  private hashCompoundVariants = (
    recipeName: string,
    compoundVariants: Array<Record<string, any>>,
    slots?: string[],
  ) => {
    const hash = (list: Array<Record<string, any>>, slot?: string) => {
      const set = getOrCreateOrderedSet(this.recipes, recipeName)
      const memo = getOrCreateSet(this.compoundHashes, recipeName)
      list.forEach((compoundVariant, index) => {
        if (!compoundVariant?.css) return
        // Through a local set, so releasing the block can find its hashes again -- they share
        // a set with the variants, which answer to a different owner.
        const local = new Set<string>()
        this.hashStyleObject(local, { [COMPOUND_VARIANT]: index }, { recipe: recipeName, slot, variants: true })
        local.forEach((hashed) => {
          set.add(hashed)
          memo.add(hashed)
          if (this.activeOwner === null) {
            this.recipeRefs.pin(hashed)
            this.pinOrderKey(set, hashed)
          }
        })
      })
    }

    if (!slots) hash(compoundVariants)
    else slots.forEach((slot) => hash(getSlotCompoundVariant(compoundVariants as Array<{ css: any }>, slot), slot))

    this.ownRecipeHashOrder(recipeName, this.compoundHashes.get(recipeName))
  }

  /**
   * Hash a recipe's computed variants into the shared per-recipe set, recording the
   * hashes this call contributed when a scope is active.
   */
  private hashVariants = (
    recipeName: string,
    computedVariants: Record<string, any>,
    baseEntry: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
  ) => {
    const set = getOrCreateOrderedSet(this.recipes, recipeName)

    const local = new Set<string>()
    this.hashStyleObject(local, computedVariants, baseEntry)

    const scope = this.activeScope
    const scoped = scope ? getOrCreateSet(scope.recipes, recipeName) : undefined
    const order = scope ? getOrCreateSet(scope.recipe_order, recipeName) : undefined
    const unowned = this.activeOwner === null
    if (unowned) {
      this.recipeEntryRefs.pin(recipeName)
      this.pinOrderKey(this.recipes, recipeName)
    }

    local.forEach((hash) => {
      set.add(hash)
      scoped?.add(hash)
      order?.add(hash)
      if (unowned) {
        this.recipeRefs.pin(hash)
        this.pinOrderKey(set, hash)
      }
    })
  }

  processConfigRecipeBase = (recipeName: string, config: RecipeConfig, pinned = false) => {
    if (!config.base) return
    this.processRecipeBaseValue(recipeName, config.base, { recipe: recipeName }, pinned)
  }

  processConfigRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config) return

    // process base styles
    this.processConfigRecipeBase(recipeName, config as RecipeConfig)

    // process variants
    const computedVariants = Object.assign({}, config.defaultVariants, variants)
    this.hashVariants(recipeName, computedVariants, { recipe: recipeName, variants: true })

    // An axis the call site did not name statically — `button({ size: props.size })`. The
    // selection carries no value for it, so the loop above emits only the default's rule and
    // the runtime then asks for `button--size_sm`, which nothing backs. A class on an element
    // with no rule behind it is silently unstyled, which is the failure the comment on
    // `hashInlineRecipe` describes and which the inline path avoids by emitting every declared
    // value. This does the same, for the axes that need it.
    //
    // Narrower than the inline rule, deliberately: only an axis some call site left dynamic is
    // enumerated, so a project whose recipe calls are all static emits exactly what it did
    // before.
    this.hashUnresolvedVariants(recipeName, config.variants, unresolved, { recipe: recipeName, variants: true })

    // process compound variants
    if (!config.compoundVariants) return
    this.ownCompound(recipeName)
    if (this.compound_variants.has(recipeName)) {
      this.ownRecipeHashOrder(recipeName, this.compoundHashes.get(recipeName))
      return
    }
    this.compound_variants.add(recipeName)
    this.hashCompoundVariants(recipeName, config.compoundVariants as Array<Record<string, any>>)
  }

  /**
   * `unresolved` names the variant axes the call site passed but the build could not read.
   * Absent from the selection is indistinguishable from never passed — `button({ size })` and
   * `button()` both arrive as `{}` — so the parser has to say which it was.
   */
  processRecipe = (recipeName: string, variants: Record<string, any>, unresolved?: Set<string>) => {
    if (!this.context.recipes.getConfig(recipeName)) return
    this.observeRecipe(recipeName)
    if (this.context.recipes.isSlotRecipe(recipeName)) {
      this.processConfigSlotRecipe(recipeName, variants, unresolved)
    } else {
      this.processConfigRecipe(recipeName, variants, unresolved)
    }
  }

  /** Every value a dynamic axis can take, so no call site can name a class with no rule. */
  private hashUnresolvedVariants = (
    recipeName: string,
    variants: Record<string, Record<string, any>> | undefined,
    unresolved: Set<string> | undefined,
    baseEntry: Partial<Omit<StyleEntry, 'prop' | 'value' | 'cond'>>,
  ) => {
    if (!unresolved?.size || !variants) return

    for (const key of unresolved) {
      // `hasOwn`, so a key of `toString` or `__proto__` does not reach `Object.prototype` and
      // enumerate nothing.
      if (!Object.hasOwn(variants, key)) continue

      for (const value of Object.keys(variants[key] ?? {})) {
        this.hashVariants(recipeName, { [key]: value }, baseEntry)
      }
    }
  }

  processRecipeBase(recipeName: string, pinned = false) {
    const config = this.context.recipes.getConfig(recipeName)
    if (!config) return

    if (this.context.recipes.isSlotRecipe(recipeName)) {
      this.processConfigSlotRecipeBase(recipeName, config as any, pinned)
    } else {
      this.processConfigRecipeBase(recipeName, config as RecipeConfig, pinned)
    }
  }

  processPattern = (name: string, patternProps: StyleResultObject) => {
    // A pattern is a `css()` call with the transform already applied — `css(stackStyles(props))`.
    this.processStyleProps(this.context.patterns.transform(name, patternProps))
  }

  /**
   * An inline `cva`, emitted the way a config recipe is: `name--size_sm` in the `recipes`
   * layer rather than atomic classes in `utilities`.
   *
   * The two differ only in where the name comes from — a config recipe is named by the key
   * it is declared under, an inline one by `getRecipeIdentity` — so a consumer's `css()`
   * wins by cascade layer against either.
   *
   * Every variant value is hashed, not just the ones some call site selected. A config
   * recipe can emit only what is used because its call sites name their variants
   * statically; an inline recipe's `button({ size: props.size })` does not, and a rule the
   * build declined to emit is an element with no styles rather than a missing override.
   */
  processAtomicRecipe = (recipe: Pick<RecipeDefinition, 'base' | 'variants' | 'compoundVariants' | 'className'>) => {
    const name = getRecipeIdentity(recipe)
    const stableRecipe = snapshotContributionObject(recipe) as unknown as RecipeConfig
    this.registerInlineRecipe(name, 'cva', stableRecipe, null)
    this.observeRecipe(name)
    this.hashInlineRecipe(name, stableRecipe)
  }

  private hashInlineRecipe = (
    name: string,
    recipe: Pick<RecipeDefinition, 'base' | 'variants' | 'compoundVariants'>,
    slots?: string[],
  ) => {
    const { base, variants = {}, compoundVariants = [] } = recipe

    if (base) {
      this.processRecipeBaseValue(name, base, { recipe: name })
    }

    for (const [variantKey, values] of Object.entries(variants)) {
      for (const variantValue of Object.keys(values ?? {})) {
        this.hashVariants(name, { [variantKey]: variantValue }, { recipe: name, variants: true })
      }
    }

    if (compoundVariants.length) {
      this.ownCompound(name)
      if (this.compound_variants.has(name) && this.compoundHashes.has(name)) {
        this.ownRecipeHashOrder(name, this.compoundHashes.get(name))
      } else {
        this.compound_variants.add(name)
        this.hashCompoundVariants(name, compoundVariants as Array<Record<string, any>>, slots)
      }
    }
  }

  processAtomicSlotRecipe = (recipe: PartialBy<SlotRecipeDefinition, 'slots'>) => {
    const inferredSlots = Recipes.inferSlots(recipe)

    // Copied rather than assigned back. `recipe` is the extractor's own `ResultItem.data`,
    // and writing to it left the config permanently changed for everything downstream —
    // including anything deriving an identity from it, which would then digest a config the
    // runtime never had.
    const withSlots = snapshotContributionObject(
      Object.assign({}, recipe, {
        slots: uniq([...(recipe.slots ?? []), ...inferredSlots].filter(Boolean)),
      }),
    ) as unknown as SlotRecipeDefinition

    // Hashed from the config as written, not from `withSlots`. The runtime derives the same
    // identity from the same object, and it does not infer slots — so hashing the inferred
    // set here gave the two sides different names, and an `sva` that omits `slots` rendered
    // with no styles at all.
    const name = getRecipeIdentity(recipe, 'sva')
    this.registerInlineRecipe(name, 'sva', withSlots, recipe.slots ? [...recipe.slots] : null)
    this.observeRecipe(name)

    // Base is per slot, so each gets its own `name__slot` rule. Variants are hashed against
    // the recipe rather than against each slot, the way `processConfigSlotRecipe` does it —
    // the decoder is what expands a variant across slots, and doing it here too would emit
    // every slot's rule once per slot.
    this.processConfigSlotRecipeBase(name, withSlots)
    this.hashInlineRecipe(
      name,
      {
        compoundVariants: withSlots.compoundVariants as never,
        variants: withSlots.variants as never,
      },
      [...withSlots.slots],
    )
  }

  /**
   * Intern every declaration of every observed recipe in the ordinary atomic pool.
   *
   * This is the emission half of static style-set compilation. The Vite fold resolves a
   * recipe selection to authored styles and asks the ordinary `css()` compiler for classes;
   * those classes need rules even though the source declared the styles through `cva`/`sva`.
   * Recipe identity is deliberately absent from the hashes written here, so a declaration
   * already reached through `css()` is reused rather than emitted again.
   *
   * Kept explicit rather than run during normal extraction: CLI/PostCSS extraction still emits
   * named recipe rules. The Vite compiler calls this once after extraction, when it also erases
   * that layer.
   */
  atomizeObservedRecipes = () => {
    const atomize = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return
      this.processAtomic(value as StyleResultObject)
    }

    for (const name of this.observedRecipes) {
      if (this.atomizedRecipes.has(name)) continue
      const config = this.context.recipes.getConfig(name)
      if (!config) continue

      const slots = Recipes.isSlotRecipeDefinition(config) ? config.slots : undefined
      const take = (value: unknown) => {
        if (!slots) {
          atomize(value)
          return
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)) return
        for (const slot of slots) atomize((value as Dict)[slot])
      }

      // Owned by the recipe, not by the files that use it: this runs once per recipe and after
      // extraction, so a file's own scope is long closed. `releaseScope` hands the owner back
      // when the last file to name the recipe stops -- which for an inline `cva` is every edit
      // of it, since its identity is derived from its styles.
      this.withOwnerKey(ownerKey('recipe', name), () => {
        take(config.base)
        for (const values of Object.values(config.variants ?? {})) {
          for (const value of Object.values(values ?? {})) take(value)
        }
        for (const compound of config.compoundVariants ?? []) take((compound as { css?: unknown })?.css)
      })

      this.atomizedRecipes.add(name)
    }
  }

  getConfigRecipeHash = (recipeName: string) => {
    return {
      atomic: this.atomic,
      base: this.recipes_base.get(recipeName)!,
      variants: this.recipes.get(recipeName)!,
    }
  }

  getConfigSlotRecipeHash = (recipeName: string) => {
    const recipeConfig = this.context.recipes.getConfigOrThrow(recipeName)

    if (!Recipes.isSlotRecipeDefinition(recipeConfig)) {
      throw new BambooError('INVALID_RECIPE', `Recipe "${recipeName}" is not a slot recipe`)
    }

    const base: Dict = {}

    recipeConfig.slots.map((slot) => {
      const recipeKey = this.context.recipes.getSlotKey(recipeName, slot)
      base[slot] = this.recipes_base.get(recipeKey)!
    })

    return {
      atomic: this.atomic,
      base,
      variants: this.recipes.get(recipeName)!,
    }
  }

  getRecipeHash = (recipeName: string) => {
    if (this.context.recipes.isSlotRecipe(recipeName)) {
      return this.getConfigSlotRecipeHash(recipeName)
    }

    return this.getConfigRecipeHash(recipeName)
  }

  toJSON = () => {
    const styles: Record<string, any> = {
      atomic: Array.from(this.atomic),
      recipes: Object.fromEntries(Array.from(this.recipes.entries()).map(([name, set]) => [name, Array.from(set)])),
    }

    // The slot styles, not a hash: the class is already the key, and rebuilding the rule
    // bodies from hashed declarations is not something the decoder can do for a pseudo
    // element it never atomized.
    if (this.view_transitions.size) {
      styles.viewTransitions = Object.fromEntries(this.view_transitions)
    }

    return {
      schemaVersion: version,
      styles,
    }
  }

  fromJSON = (json: EncoderJson) => {
    const { styles } = json

    // process atomic styles + compound variants. Pinned: a restored dump is a safelist rather
    // than a file's work, so no file's re-parse may take it away.
    styles.atomic?.forEach((hash) => {
      this.atomic.add(hash)
      this.atomicRefs.pin(hash)
      this.pinOrderKey(this.atomic, hash)
    })

    Object.entries(styles.recipes ?? {}).forEach(([recipeName, hashes]) => {
      // process base styles
      this.processRecipeBase(recipeName, true)
      // process variants hashes
      const set = getOrCreateOrderedSet(this.recipes, recipeName)
      let compounds: Set<string> | undefined
      let hasCompounds = false
      this.recipeEntryRefs.pin(recipeName)
      this.pinOrderKey(this.recipes, recipeName)
      hashes.forEach((hash) => {
        set.add(hash)
        this.recipeRefs.pin(hash)
        this.pinOrderKey(set, hash)
        try {
          const parsed = parseContributionHash(hash)
          if (parsed.recipe === recipeName && parsed.prop === COMPOUND_VARIANT) {
            ;(compounds ??= getOrCreateSet(this.compoundHashes, recipeName)).add(hash)
            hasCompounds = true
          }
        } catch {
          // Historical encoder dumps were not a strict validation boundary. Keep an
          // unfamiliar hash pinned as before; only recognized synthetic hashes need the
          // compound marker/memo that owner release consults.
        }
      })
      if (hasCompounds) {
        this.compound_variants.add(recipeName)
        this.compoundRefs.pin(recipeName)
        this.pinOrderKey(this.compound_variants, recipeName)
      }
    })

    // Keyed by the finalized class, so this restores the prefix the producing build
    // applied rather than re-deriving it from the consuming config.
    //
    // Pinned like the two above, and not merely for symmetry. Nothing could release a restored
    // transition while nothing counted it -- `Refs.release` declines an untracked key -- but a
    // local file declaring the *same* transition is what starts counting it, and that file's
    // next reading then takes the count to zero and deletes it. The dump would lose a rule to
    // an edit in a file that had nothing to do with it.
    Object.entries(styles.viewTransitions ?? {}).forEach(([className, slots]) => {
      const payload = { slots } satisfies ViewTransitionPayload
      this.assertCompatibleViewTransitionPayload(className, payload)
      this.viewTransitionRefs.pin(className)
      this.pinViewTransitionPayload(className, payload)
      this.pinOrderKey(this.view_transitions, className)
      this.pinOrderKey(this.viewTransitionInputs, className)
    })

    return this
  }
}

const getOrCreateOrderedSet = (map: Map<string, Set<string>>, key: string) => {
  const existing = map.get(key)
  if (existing) return existing
  const created = new OrderableSet()
  map.set(key, created)
  return created
}

const sameOrdered = (left: Iterable<string>, right: Iterable<string>) => {
  const leftValues = Array.from(left)
  const rightValues = Array.from(right)
  return leftValues.length === rightValues.length && leftValues.every((value, index) => value === rightValues[index])
}

const sameJson = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJson(value, right[index]))
    )
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key, index) => rightKeys[index] === key && sameJson(leftRecord[key], rightRecord[key]))
  )
}

/** `viewTransitionClassName` sorts object keys recursively but preserves array/value order. */
const sameJsonIgnoringObjectOrder = (left: unknown, right: unknown): boolean => {
  if (Object.is(left, right)) return true
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameJsonIgnoringObjectOrder(value, right[index]))
    )
  }
  const leftRecord = left as Record<string, unknown>
  const rightRecord = right as Record<string, unknown>
  const leftKeys = Object.keys(leftRecord)
  const rightKeys = Object.keys(rightRecord)
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) => Object.hasOwn(rightRecord, key) && sameJsonIgnoringObjectOrder(leftRecord[key], rightRecord[key]),
    )
  )
}

const sameViewTransitionSemantics = (left: ViewTransitionPayload, right: ViewTransitionPayload) =>
  (left.input === undefined || right.input === undefined || sameJsonIgnoringObjectOrder(left.input, right.input)) &&
  sameJsonIgnoringObjectOrder(left.slots, right.slots)

const snapshotContributionObject = (input: unknown) => {
  const captured = captureStyleContributionJsonObject(input)
  return restoreStyleContributionJsonObject(captured.value, captured.objectOrder)
}

const filterProps = (isValidProperty: (key: string) => boolean, props: Dict) => {
  const clone = {} as Dict
  for (const [key, value] of Object.entries(props)) {
    if ((isValidProperty(key) || key === 'css' || key.endsWith('Css')) && value !== undefined) {
      clone[key] = value
    }
  }
  return clone
}

const hashStyleEntry = (entry: StyleEntry) => {
  const parts = [`${entry.prop}${StyleEncoder.separator}value:${entry.value}`]

  if (entry.cond) {
    parts.push(`cond:${entry.cond}`)
  }

  if (entry.recipe) {
    parts.push(`recipe:${entry.recipe}`)
  }

  if (entry.layer) {
    parts.push(`layer:${entry.layer}`)
  }

  if (entry.slot) {
    parts.push(`slot:${entry.slot}`)
  }

  return parts.join(StyleEncoder.separator)
}

/**
 * Returns the final condition string after filtering out irrelevant parts. ('base' and props)
 * @example
 * 'marginTop<___>md' => 'md'
 * 'marginTop<___>md<___>lg' => 'md<___>lg'
 * '_hover' => '_hover'
 * '& > p<___>base', => '& > p'
 * '@media base' => '@media base'
 * '_hover<___>base<___>_dark' => '_hover<___>_dark'
 *
 */
const getResolvedCondition = (cond: string, isCondition: (key: string) => boolean): string => {
  if (!cond) {
    return ''
  }

  const parts = cond.split(StyleEncoder.conditionSeparator)
  const relevantParts = parts.filter((part) => part !== 'base' && isCondition(part))

  if (parts.length !== relevantParts.length) {
    return relevantParts.join(StyleEncoder.conditionSeparator)
  }

  return cond
}
