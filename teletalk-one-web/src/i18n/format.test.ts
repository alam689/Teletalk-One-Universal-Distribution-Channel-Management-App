import { describe, expect, it } from 'vitest'
import {
  formatIdentifier,
  formatMoney,
  formatQuantity,
  maskMsisdn,
  toBengaliDigits,
  toLatinDigits,
} from './format'

/**
 * The numeral rule is the single most load-bearing convention in this codebase:
 * quantities localise, identifiers never do. These tests pin both halves.
 */

describe('toLatinDigits', () => {
  it('normalises Bengali digits typed on a Bangla keyboard', () => {
    expect(toLatinDigits('২০০৬০৭৯৪')).toBe('20060794')
  })

  it('normalises Arabic-Indic digits', () => {
    expect(toLatinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789')
  })

  it('leaves Latin digits and other characters untouched', () => {
    expect(toLatinDigits('BD-2006 0794')).toBe('BD-2006 0794')
  })

  it('handles mixed scripts in one string', () => {
    expect(toLatinDigits('২00৬')).toBe('2006')
  })
})

describe('toBengaliDigits', () => {
  it('converts Latin digits', () => {
    expect(toBengaliDigits('2026')).toBe('২০২৬')
  })

  it('leaves non-digits alone', () => {
    expect(toBengaliDigits('BD 12')).toBe('BD ১২')
  })
})

describe('formatQuantity', () => {
  it('renders Bengali digits with grouping in Bangla', () => {
    expect(formatQuantity(11731, 'bn')).toBe('১১,৭৩১')
  })

  it('renders Latin digits in English', () => {
    expect(formatQuantity(11731, 'en')).toBe('11,731')
  })

  it('honours Intl options', () => {
    expect(formatQuantity(4, 'bn', { minimumIntegerDigits: 2 })).toBe('০৪')
  })

  it('handles zero', () => {
    expect(formatQuantity(0, 'bn')).toBe('০')
  })
})

describe('formatMoney', () => {
  it('always uses the taka sign and two decimals', () => {
    expect(formatMoney(11731.04, 'bn')).toBe('৳ ১১,৭৩১.০৪')
    expect(formatMoney(11731.04, 'en')).toBe('৳ 11,731.04')
  })

  it('pads a whole number to two decimals', () => {
    expect(formatMoney(50, 'en')).toBe('৳ 50.00')
  })
})

describe('formatIdentifier', () => {
  it('stays Latin regardless of input script', () => {
    expect(formatIdentifier('২০০৬০৭৯৪')).toBe('20060794')
  })

  it('strips spaces and dashes so codes match across systems', () => {
    expect(formatIdentifier('2006-0794 ')).toBe('20060794')
  })
})

describe('maskMsisdn', () => {
  it('masks the middle and keeps the last two digits', () => {
    expect(maskMsisdn('8801714080287')).toBe('8801714****87')
  })

  it('normalises Bengali digits before masking', () => {
    expect(maskMsisdn('৮৮০১৭১৪০৮০২৮৭')).toBe('8801714****87')
  })

  it('returns short inputs unchanged rather than throwing', () => {
    expect(maskMsisdn('123')).toBe('123')
  })
})
