import type { OutboxEntry } from '../../lib/outbox'
import type { IconName } from '../home/menu'
import type { StatusTone } from '../../components/data'
import type { LedgerEntry, LedgerKind, LedgerState } from './counterTypes'

/**
 * The ledger's one interesting problem: **the server's list is not the whole
 * truth.**
 *
 * A retailer who activated a SIM with the tower down goes to this screen to
 * ask "did that go through?". The server has never heard of it. So the client
 * merges its own unsent queue in, marked as local, and the answer is on the
 * screen instead of being a phone call to the zonal office.
 *
 * Only *unsettled* queue entries are merged. Once the server has confirmed
 * one it appears in the server's own list, and showing both would have the
 * retailer counting the same activation twice.
 */

const KIND_ICON: Record<LedgerKind, IconName> = {
  activation: 'sim',
  replacement: 'simSwap',
  portIn: 'portIn',
  ownership: 'transfer',
  planMigration: 'migrate',
  recharge: 'bolt',
  productSell: 'box',
}

const STATE_TONE: Record<LedgerState, StatusTone> = {
  settled: 'ok',
  pending: 'warn',
  failed: 'danger',
  reversed: 'muted',
}

export const iconForKind = (kind: LedgerKind): IconName => KIND_ICON[kind] ?? 'list'
export const toneForState = (state: LedgerState): StatusTone => STATE_TONE[state] ?? 'muted'

const KNOWN_KINDS = new Set<string>(Object.keys(KIND_ICON))

function readBody(body: unknown): { msisdn: string; amount?: number } {
  if (typeof body !== 'object' || body === null) return { msisdn: '' }
  const record = body as Record<string, unknown>
  return {
    msisdn: typeof record.msisdn === 'string' ? record.msisdn : '',
    amount: typeof record.amount === 'number' ? record.amount : undefined,
  }
}

/** Queue entries the server has not confirmed, as ledger rows. */
export function queuedAsLedger(entries: OutboxEntry[]): LedgerEntry[] {
  return entries
    .filter((e) => e.status !== 'settled')
    .filter((e) => KNOWN_KINDS.has(e.kind))
    .map((entry) => {
      const { msisdn, amount } = readBody(entry.body)
      return {
        // The idempotency key, not a CBS reference — there isn't one yet, and
        // inventing something that looks like one would be worse than blank.
        id: entry.id,
        kind: entry.kind as LedgerKind,
        msisdn,
        amount,
        at: new Date(entry.queuedAt).toISOString(),
        state: entry.status === 'failed' ? 'failed' : 'pending',
        local: true,
      }
    })
}

export type LedgerFilter = 'all' | 'activation' | 'recharge' | 'attention'

/** `attention` is the filter a retailer actually wants: what isn't finished. */
export function applyFilter(rows: LedgerEntry[], filter: LedgerFilter): LedgerEntry[] {
  switch (filter) {
    case 'activation':
      return rows.filter((r) => r.kind !== 'recharge' && r.kind !== 'productSell')
    case 'recharge':
      return rows.filter((r) => r.kind === 'recharge' || r.kind === 'productSell')
    case 'attention':
      return rows.filter((r) => r.state !== 'settled')
    default:
      return rows
  }
}

/** Newest first, with the queue's own rows above the server's at equal times. */
export function mergeLedger(server: LedgerEntry[], queued: LedgerEntry[]): LedgerEntry[] {
  return [...queued, ...server].sort((a, b) => {
    const diff = new Date(b.at).getTime() - new Date(a.at).getTime()
    if (diff !== 0) return diff
    return Number(b.local ?? false) - Number(a.local ?? false)
  })
}
