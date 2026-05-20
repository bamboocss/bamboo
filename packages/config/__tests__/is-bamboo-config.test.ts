import { isBambooConfig } from '../src/is-bamboo-config'

describe('is-bamboo-config', () => {
  test('should work as expected', () => {
    expect(isBambooConfig('bamboo.config.ts')).toBe(true)
    expect(isBambooConfig('testing-bamboo.config.ts')).toBe(false)
    expect(isBambooConfig('bamboo-config.ts')).toBe(false)
  })
})
