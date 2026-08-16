import { describe, expect, it } from 'vitest'
import type { OutboxEntry } from '../../lib/outbox'
import type { LedgerEntry } from './counterTypes'
import { applyFilter, mergeLedger, queuedAsLedger } from './ledger'

/**
 * The ledger's job is to answer "did that go through?" honestly. These cases
 * are the ways it could answer wrongly.
 */

const entry = (over: Partial<OutboxEntry>): OutboxEntry => ({
  id: 'k-1',
  kind: 'activation',
  path: '/transactions',
  method: 'POST',
  body: { msisdn: '01512345678' },
  status: 'pending',
  attempts: 0,
  queuedAt: Date.parse('2026-08-16T10:00:00Z'),
  nextAttemptAt: 0,
  ...over,
})

const row = (over: Partial<LedgerEntry>): LedgerEntry => ({
  id: 'ACT1',
  kind: 'activation',
  msisdn: '01512345678',
  at: '2026-08-16T09:00:00Z',
  state: 'settled',
  ...over,
})

describe('the queue, as ledger rows', () => {
  it('shows what the server has not confirmed', () => {
    const rows = queuedAsLedger([entry({}), entry({ id: 'k-2', status: 'failed' })])
    expect(rows.map((r) => r.state)).toEqual(['pending', 'failed'])
    expect(rows.every((r) => r.local)).toBe(true)
  })

  it('drops settled entries — the server already lists those', () => {
    // Otherwise the retailer counts the same activation twice, which on a
    // commission screen is a phone call to the zonal office.
    expect(queuedAsLedger([entry({ status: 'settled' })])).toEqual([])
  })

  it('carries the amount through for a recharge', () => {
    const [rowOut] = queuedAsLedger([
      entry({ kind: 'recharge', body: { msisdn: '01512345678', amount: 50 } }),
    ])
    expect(rowOut.amount).toBe(50)
  })

  it('ignores a queue entry whose kind is not a ledger kind', () => {
    expect(queuedAsLedger([entry({ kind: 'somethingElse' })])).toEqual([])
  })
})

describe('merging', () => {
  it('puts the newest first and the queue above the server at equal times', () => {
    const merged = mergeLedger(
      [row({ id: 'ACT-OLD', at: '2026-08-15T09:00:00Z' }), row({ id: 'ACT-NEW' })],
      queuedAsLedger([entry({ queuedAt: Date.parse('2026-08-16T09:00:00Z') })]),
    )
    expect(merged.map((r) => r.id)).toEqual(['k-1', 'ACT-NEW', 'ACT-OLD'])
  })
})

describe('filters', () => {
  const rows = [
    row({ id: 'a', kind: 'activation' }),
    row({ id: 'b', kind: 'recharge', state: 'settled' }),
    row({ id: 'c', kind: 'portIn', state: 'pending' }),
    row({ id: 'd', kind: 'productSell' }),
  ]

  it('splits SIM work from money work', () => {
    expect(applyFilter(rows, 'activation').map((r) => r.id)).toEqual(['a', 'c'])
    expect(applyFilter(rows, 'recharge').map((r) => r.id)).toEqual(['b', 'd'])
  })

  it('“unfinished” is anything not settled — the filter retailers actually want', () => {
    expect(applyFilter(rows, 'attention').map((r) => r.id)).toEqual(['c'])
  })

  it('leaves everything alone by default', () => {
    expect(applyFilter(rows, 'all')).toHaveLength(4)
  })
})
