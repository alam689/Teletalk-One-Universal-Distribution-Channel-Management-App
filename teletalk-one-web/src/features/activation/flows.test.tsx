import { describe, expect, it } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { outbox } from '../../lib/outbox'
import { useWizard } from '../wizard/useWizard'
import type { WizardState } from '../wizard/types'
import { buildFlow } from './flows'
import { FLOW_SPECS } from './flowSpec'
import type { FlowData } from './activationTypes'

/**
 * The FE-1.1 exit criterion in executable form: **all five SIM flows run on the
 * one engine**.
 *
 * If a flow ever needs the engine to learn something about SIMs, this file is
 * where it shows up — a new branch here means the abstraction has stopped being
 * real, and the next flow will cost a rewrite rather than a config object.
 */

const TODAY = new Date(Date.UTC(2026, 7, 16))

/** Valid for every flow at once; each one validates only the fields it uses. */
const FILL: Partial<FlowData> = {
  simSerial: '8988015123456789012',
  msisdn: '01512345678',
  productCode: 'AGNI',
  donorOperator: 'Grameenphone',
  reasonCode: 'lost',
  nid: '1234567890',
  // The mock's EC record; a mismatch is its own (tested) failure path.
  dateOfBirth: '1994-03-17',
  nameBn: 'মোছাঃ রেহানা পারভীন',
  nameEn: 'Most. Rehana Parvin',
  fatherNameBn: 'মোঃ আব্দুল করিম',
  motherNameBn: 'মোছাঃ আনোয়ারা বেগম',
  gender: 'female',
  contactMsisdn: '01712345678',
  division: 'Rangpur',
  district: 'Nilphamari',
  upazila: 'Saidpur',
  postCode: '5310',
  addressLine: 'হোল্ডিং ১২, মুন্সিপাড়া',
  consentKyc: true,
  biometric: { method: 'device', reference: 'BVS123456', capturedAt: TODAY.toISOString() },
}

async function runToEnd(get: () => WizardState<FlowData>) {
  for (let guard = 0; guard < 12; guard++) {
    if (get().step.terminal) return
    await act(async () => {
      get().next()
    })
    await waitFor(() => expect(get().busy).toBe(false), { timeout: 5000 })
    expect(get().commitError, `${get().step.id} was refused`).toBeNull()
    expect(get().errors, `${get().step.id} did not validate`).toEqual({})
  }
  throw new Error(`flow did not terminate; stuck on ${get().step.id}`)
}

describe.each(FLOW_SPECS)('flow: $id', (spec) => {
  it(
    'runs end to end on the shared engine and queues one transaction',
    async () => {
      const config = buildFlow(spec, { posCode: '20060794', today: TODAY })
      const { result } = renderHook(() => useWizard(config))

      act(() => result.current.update(FILL))
      await runToEnd(() => result.current)

      expect(result.current.step.id).toBe('done')
      expect(result.current.data.outboxId).not.toBe('')

      const queued = outbox.get(result.current.data.outboxId)
      expect(queued?.kind).toBe(spec.kind)
      expect(queued?.path).toBe('/transactions')
    },
    20_000,
  )

  it('declares the steps the spec asked for, in order', () => {
    const config = buildFlow(spec, { posCode: '20060794', today: TODAY })
    expect(config.steps.map((s) => s.id)).toEqual(spec.steps)
  })

  it('never lets a biometric reference reach storage', () => {
    const config = buildFlow(spec, { posCode: '20060794', today: TODAY })
    expect(config.redact).toContain('biometric')
  })
})

describe('flow registry', () => {
  it('namespaces the draft by outlet, so one retailer cannot inherit another’s', () => {
    const a = buildFlow(FLOW_SPECS[0], { posCode: '20060794' })
    const b = buildFlow(FLOW_SPECS[0], { posCode: '30010001' })
    expect(a.id).not.toBe(b.id)
  })

  it('offers the inline first recharge on activation and nowhere else', () => {
    // Recharging a replacement SIM is the customer's existing balance, not a
    // first recharge; offering it here would be a different transaction wearing
    // the same button.
    expect(FLOW_SPECS.filter((f) => f.recharge).map((f) => f.id)).toEqual(['simActivate'])
  })
})
