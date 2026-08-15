import { describe, expect, it } from 'vitest'
import { PASSWORD_RULES } from './ChangePasswordPage'

const evaluate = (next: string, confirm = next) =>
  Object.fromEntries(PASSWORD_RULES.map((r) => [r.id, r.test(next, confirm)]))

describe('password policy rules', () => {
  it('rejects an empty password on every rule', () => {
    expect(evaluate('')).toEqual({
      length: false,
      upper: false,
      digit: false,
      symbol: false,
      match: false,
    })
  })

  it('accepts a password meeting every requirement', () => {
    expect(evaluate('Notun@2026')).toEqual({
      length: true,
      upper: true,
      digit: true,
      symbol: true,
      match: true,
    })
  })

  it('fails length at seven characters and passes at eight', () => {
    expect(evaluate('Ab@1234').length).toBe(false)
    expect(evaluate('Ab@12345').length).toBe(true)
  })

  it('requires an uppercase letter', () => {
    expect(evaluate('notun@2026').upper).toBe(false)
  })

  it('requires a digit', () => {
    expect(evaluate('NotunPass@').digit).toBe(false)
  })

  it('requires a symbol', () => {
    expect(evaluate('NotunPass2026').symbol).toBe(false)
  })

  it('does not treat a Bangla character as an uppercase Latin letter', () => {
    expect(evaluate('পাসওয়ার্ড@2026').upper).toBe(false)
  })

  it('counts a Bangla character as a symbol, since it is not A-Za-z0-9', () => {
    expect(evaluate('Password2026প').symbol).toBe(true)
  })

  it('fails match when the confirmation differs', () => {
    expect(evaluate('Notun@2026', 'Notun@2027').match).toBe(false)
  })
})
