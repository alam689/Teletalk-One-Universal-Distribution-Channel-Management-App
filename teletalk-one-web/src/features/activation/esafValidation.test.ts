import { describe, expect, it } from 'vitest'
import { EMPTY_FLOW_DATA, type EsafData } from './activationTypes'
import {
  ageOn,
  dateOfBirthError,
  maskNid,
  maskReference,
  msisdnError,
  nameBnError,
  nameEnError,
  nidError,
  postCodeError,
  simSerialError,
  validateEsaf,
  validateRecharge,
} from './esafValidation'

/**
 * These are regulatory rules, not form cosmetics — age, NID format and consent
 * are what BTRC audits. Each case below is a way the counter gets it wrong.
 */

const TODAY = new Date(Date.UTC(2026, 7, 16)) // 16 August 2026

const VALID: EsafData = {
  nameBn: 'মোছাঃ রেহানা পারভীন',
  nameEn: 'Most. Rehana Parvin',
  fatherNameBn: 'মোঃ আব্দুল করিম',
  motherNameBn: 'মোছাঃ আনোয়ারা বেগম',
  dateOfBirth: '1994-03-17',
  gender: 'female',
  nid: '1234567890',
  contactMsisdn: '01712345678',
  division: 'Rangpur',
  district: 'Nilphamari',
  upazila: 'Saidpur',
  postCode: '5310',
  addressLine: 'হোল্ডিং ১২, মুন্সিপাড়া',
  consentKyc: true,
  consentMarketing: false,
}

describe('NID', () => {
  it('accepts the three formats that exist and nothing else', () => {
    expect(nidError('1234567890')).toBeNull()
    expect(nidError('1234567890123')).toBeNull()
    expect(nidError('12345678901234567')).toBeNull()
    expect(nidError('12345678901')).toBe('error.nidLength')
  })

  it('accepts a number typed on a Bangla keyboard', () => {
    // The retailer's phone is in Bangla; the digits it emits are ০-৯.
    expect(nidError('১২৩৪৫৬৭৮৯০')).toBeNull()
  })

  it('names the fix when the field is empty', () => {
    expect(nidError('')).toBe('error.nidRequired')
  })
})

describe('MSISDN', () => {
  it('requires 11 digits starting 01', () => {
    expect(msisdnError('01712345678')).toBeNull()
    expect(msisdnError('0171234567')).toBe('error.msisdnFormat')
    expect(msisdnError('91712345678')).toBe('error.msisdnFormat')
  })

  it('separates "any operator" from "must be Teletalk"', () => {
    expect(msisdnError('01712345678', true)).toBe('error.msisdnNotTeletalk')
    expect(msisdnError('01512345678', true)).toBeNull()
    expect(msisdnError('01712345678', false)).toBeNull()
  })
})

describe('SIM serial', () => {
  it('takes a 19 or 20 digit ICCID beginning 89', () => {
    expect(simSerialError('8988015123456789012')).toBeNull()
    expect(simSerialError('89880151234567890123')).toBeNull()
    expect(simSerialError('898801512345678')).toBe('error.simSerialLength')
    expect(simSerialError('1288015123456789012')).toBe('error.simSerialPrefix')
  })
})

describe('names', () => {
  it('rejects a Bangla field the keyboard never switched for', () => {
    expect(nameBnError('Rehana Parvin', 'error.nameRequired')).toBe('error.nameNotBangla')
    expect(nameBnError('রেহানা পারভীন', 'error.nameRequired')).toBeNull()
  })

  it('rejects a Latin field typed in Bangla', () => {
    expect(nameEnError('রেহানা')).toBe('error.nameNotLatin')
    expect(nameEnError("Most. Rehana O'Parvin-Khan")).toBeNull()
  })
})

describe('age', () => {
  it('counts whole years, and does not round up before the birthday', () => {
    expect(ageOn('2008-08-16', TODAY)).toBe(18)
    expect(ageOn('2008-08-17', TODAY)).toBe(17)
  })

  it('rejects a date that does not exist', () => {
    expect(ageOn('2005-02-30', TODAY)).toBeNull()
    expect(dateOfBirthError('2005-02-30', TODAY)).toBe('error.dobInvalid')
  })

  it('blocks registration under 18 and says so', () => {
    expect(dateOfBirthError('2008-08-17', TODAY)).toBe('error.dobUnderage')
    expect(dateOfBirthError('2008-08-16', TODAY)).toBeNull()
  })

  it('rejects a future date of birth', () => {
    expect(dateOfBirthError('2030-01-01', TODAY)).toBe('error.dobFuture')
  })
})

describe('post code', () => {
  it('is exactly four digits', () => {
    expect(postCodeError('5310')).toBeNull()
    expect(postCodeError('531')).toBe('error.postCodeLength')
  })
})

describe('the whole form', () => {
  it('passes a complete record', () => {
    expect(validateEsaf(VALID, TODAY)).toEqual({})
  })

  it('reports every problem at once — one at a time is a queue', () => {
    const errors = validateEsaf({ ...VALID, nameEn: '', nid: '', postCode: 'x' }, TODAY)
    expect(Object.keys(errors).sort()).toEqual(['nameEn', 'nid', 'postCode'])
  })

  it('blocks the transaction without KYC consent', () => {
    const errors = validateEsaf({ ...VALID, consentKyc: false }, TODAY)
    expect(errors.consentKyc).toBe('error.consentRequired')
  })

  it('treats marketing consent as genuinely optional', () => {
    expect(validateEsaf({ ...VALID, consentMarketing: false }, TODAY)).toEqual({})
  })
})

describe('recharge amount', () => {
  const base = { ...EMPTY_FLOW_DATA, rechargeWanted: true }

  it('holds the counter to the published range', () => {
    expect(validateRecharge({ ...base, rechargeAmount: '50' })).toEqual({})
    expect(validateRecharge({ ...base, rechargeAmount: '9' }).rechargeAmount).toBe(
      'error.amountRange',
    )
    expect(validateRecharge({ ...base, rechargeAmount: '5001' }).rechargeAmount).toBe(
      'error.amountRange',
    )
  })

  it('is not asked for when the customer declines', () => {
    expect(validateRecharge({ ...base, rechargeWanted: false, rechargeAmount: '' })).toEqual({})
  })
})

describe('masking', () => {
  it('shows only the last four digits of an NID', () => {
    expect(maskNid('1234567890')).toBe('••••••7890')
    expect(maskNid('12345678901234567')).toBe('•••••••••••••4567')
  })

  it('never shows a biometric reference in full', () => {
    const masked = maskReference('BVS20260816X41')
    expect(masked).toBe('••••••••••6X41')
    expect(masked).toHaveLength('BVS20260816X41'.length)
  })
})
