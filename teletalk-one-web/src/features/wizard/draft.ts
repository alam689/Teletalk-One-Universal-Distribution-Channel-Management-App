import { logger } from '../../lib/logger'

/**
 * Draft persistence for in-flight transactions.
 *
 * **sessionStorage, not localStorage.** A draft carries the customer's name,
 * NID and address. The retailer counter is a shared terminal: localStorage
 * would leave the last walk-in's NID on the machine for the next one, and for
 * anyone who picks the phone up. sessionStorage is scoped to the tab and dies
 * with it, while still surviving the reload — which is the actual requirement.
 *
 * Nothing here is a substitute for the redaction list in the config: biometric
 * templates and OTPs never reach storage at all.
 */

const PREFIX = 'teletalk.draft.'

/** A draft older than this is a different customer. */
const TTL_MS = 2 * 60 * 60 * 1000

interface Envelope<TData> {
  v: number
  at: number
  stepId: string
  data: TData
}

const keyFor = (id: string) => `${PREFIX}${id}`

function strip<TData extends object>(
  data: TData,
  redact: readonly (keyof TData)[] = [],
): TData {
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
  const envelope: Envelope<TData> = {
    v: version,
    at: Date.now(),
    stepId,
    data: strip(data, redact),
  }
  try {
    sessionStorage.setItem(keyFor(id), JSON.stringify(envelope))
  } catch {
    /* quota or private mode — the flow still works, it just can't resume */
  }
}

export function readDraft<TData>(
  id: string,
  version: number,
): { stepId: string; data: TData } | null {
  let raw: string | null = null
  try {
    raw = sessionStorage.getItem(keyFor(id))
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const envelope = JSON.parse(raw) as Envelope<TData>
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
  } catch (err) {
    logger.warn('unreadable draft discarded', { id, err })
    clearDraft(id)
    return null
  }
}

export function clearDraft(id: string): void {
  try {
    sessionStorage.removeItem(keyFor(id))
  } catch {
    /* ignore */
  }
}

/**
 * Sign-out, idle timeout and cross-tab sign-out all land here. Leaving a
 * half-typed e-SAF behind after the counter is handed over is the exact
 * disclosure the tab-scoped store is meant to prevent.
 */
export function clearAllDrafts(): void {
  try {
    const doomed: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key?.startsWith(PREFIX)) doomed.push(key)
    }
    for (const key of doomed) sessionStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}
