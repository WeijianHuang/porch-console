import { describe, expect, it } from 'vitest'
import type { VisibleShop } from '../api/types'
import { activeShops, resolveCurrentShop } from './visibility'

const shops: VisibleShop[] = [
  { public_id: 's1', name: '一号店', status: 'active' },
  { public_id: 's2', name: '二号店', status: 'inactive' },
  { public_id: 's3', name: '三号店', status: 'active' },
]

describe('shop visibility', () => {
  it('only active shops can become current', () => {
    expect(activeShops(shops).map((shop) => shop.public_id)).toEqual(['s1', 's3'])
  })

  it('keeps a remembered shop only when it is still visible and active', () => {
    expect(resolveCurrentShop(shops, 's1', 's3')).toBe('s3')
    expect(resolveCurrentShop(shops, 's1', 's2')).toBe('s1')
  })

  it('falls back to the server default and never invents a shop', () => {
    expect(resolveCurrentShop(shops, 's3', 'removed')).toBe('s3')
    expect(resolveCurrentShop([], null, 's1')).toBeNull()
    expect(resolveCurrentShop(shops, null, null)).toBeNull()
  })
})
