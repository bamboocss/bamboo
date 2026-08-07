// @vitest-environment jsdom
import { expect, test, describe } from 'vitest'
import { auditSlotScopes, sva } from '../styled-system/css/sva'

const select = sva({
  className: 'select',
  slots: ['root', 'trigger', 'positioner', 'item'],
  scopeRoots: ['root'],
  variants: { size: { lg: { trigger: { h: '11' }, item: { px: '3' } } } },
})

describe('auditSlotScopes', () => {
  test('reports a slot rendered outside every anchor', () => {
    document.body.innerHTML = `
      <div class="select__root select__root--size_lg"><button class="select__trigger"></button></div>
      <div class="select__positioner"><div class="select__item"></div></div>`
    const found: any[] = []
    auditSlotScopes([select], { onReport: (p: any[]) => found.push(...p) })
    expect(found.map((p) => p.slot)).toEqual(['item'])
  })

  test('stays quiet when every scoped slot is inside an anchor', () => {
    document.body.innerHTML = `
      <div class="select__root select__root--size_lg">
        <button class="select__trigger"></button><div class="select__item"></div>
      </div>`
    const found: any[] = []
    auditSlotScopes([select], { onReport: (p: any[]) => found.push(...p) })
    expect(found).toEqual([])
  })

  test('an anchor with no variant selected is still an anchor', () => {
    // Matching on the variant class would report this as unreachable; it is not.
    document.body.innerHTML = `<div class="select__root"><div class="select__item"></div></div>`
    const found: any[] = []
    auditSlotScopes([select], { onReport: (p: any[]) => found.push(...p) })
    expect(found).toEqual([])
  })

  test('a second anchor fixes it', () => {
    const twoAnchors = sva({
      className: 'sel2',
      slots: ['root', 'positioner', 'item'],
      scopeRoots: ['root', 'positioner'],
      variants: { size: { lg: { item: { px: '3' } } } },
    })
    document.body.innerHTML = `
      <div class="sel2__root"></div><div class="sel2__positioner"><div class="sel2__item"></div></div>`
    const found: any[] = []
    auditSlotScopes([twoAnchors], { onReport: (p: any[]) => found.push(...p) })
    expect(found).toEqual([])
  })

  test('an unscoped recipe is never reported', () => {
    const none = sva({
      className: 'card',
      slots: ['root', 'item'],
      scopeRoots: [],
      variants: { size: { lg: { item: { px: '3' } } } },
    })
    document.body.innerHTML = `<div class="card__item"></div>`
    const found: any[] = []
    auditSlotScopes([none], { onReport: (p: any[]) => found.push(...p) })
    expect(found).toEqual([])
  })
})
