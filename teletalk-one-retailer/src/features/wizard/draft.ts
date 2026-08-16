import { logger } from '../../lib/logger'
import { vault, VaultKeys } from '../../lib/storage'

/**
 * Draft persistence for in-flight transactions.
 *
 * **The keystore, and one entry for all of them.** A draft carries the
 * customer's name, NID and address. The portal kept these in `sessionStorage`
 * because a retailer counter is a shared terminal; the phone equivalent of that
 * protection is the OS keystore, which is what `vault` is.
 *
 * They live in a single map under one key rather than a key each, because the
 * store hydrates a declared list of keys at boot — a per-draft key could not be
 * known in advance, and would read as absent on the first render after a
 * restart and then quietly appear.
 *
 * Nothing here is a substitute for the redaction list in each flow's config:
 * biometric templates and OTPs never reach storage at all.
 */

/** A draft older than this is a different customer. */
const TTL_MS = 2 * 60 * 60 * 1000

interface Envelope<TData> {
  v: number
  at: number
  stepId: string
  data: TData
}

type DraftMap = Record<string, Envelope<unknown>>

function readAll(): DraftMap {
  const raw = vault.get(VaultKeys.draft)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as DraftMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch (err) {
    logger.warn('unreadable draft store discarded', { err })
    return {}
  }
}

function writeAll(map: DraftMap): void {
  try {
    vault.set(VaultKeys.draft, JSON.stringify(map))
  } catch {
    /* a locked keystore — the flow still works, it just can't resume */
  }
}

function strip<TData extends object>(data: TData, redact: readonly (keyof TData)[] = []): TData {
  if (redact.length === 0) return data
  const copy = { ...data }
  for (const field of redact) delete copy[field]
  return copy
}

export function saveDraft<TData extends object>(
  id: string,
  version: number,
  stepId: string,
  data: TData,
  redact?: readonly (keyof TData)[],
): void {
  const map = readAll()
  map[id] = { v: version, at: Date.now(), stepId, data: strip(data, redact) }
  writeAll(map)
}

export function readDraft<TData>(
  id: string,
  version: number,
): { stepId: string; data: TData } | null {
  const envelope = readAll()[id] as Envelope<TData> | undefined
  if (!envelope) return null

  // A draft from an older shape would half-populate the form with fields that
  // no longer mean what they meant. Discard rather than migrate.
  if (envelope.v !== version) {
    clearDraft(id)
    return null
  }
  if (Date.now() - envelope.at > TTL_MS) {
    clearDraft(id)
    return null
  }
  return { stepId: envelope.stepId, data: envelope.data }
}

export function clearDraft(id: string): void {
  const map = readAll()
  if (!(id in map)) return
  delete map[id]
  writeAll(map)
}

/**
 * Sign-out and the idle timeout both land here. Leaving a half-typed e-SAF
 * behind after the handset is put down is the exact disclosure the keystore is
 * meant to prevent.
 */
export function clearAllDrafts(): void {
  vault.remove(VaultKeys.draft)
}
