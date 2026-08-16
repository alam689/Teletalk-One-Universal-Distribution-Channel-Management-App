import { useCallback, useMemo, useRef, useState } from 'react'
import { errorKey } from '../../lib/http'
import { clearDraft, readDraft, saveDraft } from './draft'
import type { FieldErrors, LeavePolicy, WizardConfig, WizardState, WizardStep } from './types'

/**
 * The engine. It knows about steps, validation, commits and drafts, and
 * nothing whatsoever about SIMs, NIDs or recharge — that is the whole point:
 * five flows share it, and a sixth costs a config object.
 *
 * There is deliberately no `beforeunload` guard. The draft already survives a
 * reload, so the browser's "leave site?" dialog would be a scary prompt that
 * protects against nothing, on a device where the retailer is one stray swipe
 * from triggering it.
 */

function enabledSteps<TData>(steps: WizardStep<TData>[], data: TData): WizardStep<TData>[] {
  return steps.filter((s) => s.enabled?.(data) ?? true)
}

export function useWizard<TData extends object>(config: WizardConfig<TData>): WizardState<TData> {
  const { id, version, steps: allSteps, initialData, redact } = config

  // Read the draft exactly once per mount, before the first paint, so the form
  // never flashes empty and then fills in.
  const restored = useRef<{ stepId: string; data: TData } | null | undefined>(undefined)
  if (restored.current === undefined) restored.current = readDraft<TData>(id, version)
  const resumed = restored.current !== null

  const [data, setData] = useState<TData>(() => ({
    ...initialData,
    ...(restored.current?.data ?? {}),
  }))
  const [stepId, setStepId] = useState<string>(() => restored.current?.stepId ?? allSteps[0].id)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [commitError, setCommitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  /** Nothing is persisted until the retailer actually types something. */
  const dirty = useRef(resumed)

  /**
   * The double-tap guard, and it has to be a ref rather than the `busy` state.
   * React batches two clicks landing in the same tick, so both handlers would
   * read `busy === false` and both would fire the commit — which on the review
   * step means two queued activations under two different idempotency keys.
   */
  const busyRef = useRef(false)

  const steps = useMemo(() => enabledSteps(allSteps, data), [allSteps, data])
  const rawIndex = steps.findIndex((s) => s.id === stepId)
  // A step can disappear underneath us when `enabled` flips (recharge declined
  // while standing on the recharge step). Falling back to the first step is
  // wrong; clamping to the last reachable one is what the retailer expects.
  const index = rawIndex === -1 ? Math.min(steps.length - 1, 0) : rawIndex
  const step = steps[index] ?? allSteps[0]

  const dataRef = useRef(data)
  dataRef.current = data
  const stepRef = useRef(step)
  stepRef.current = step

  const persist = useCallback(
    (nextStepId: string, nextData: TData) => {
      if (!dirty.current) return
      saveDraft(id, version, nextStepId, nextData, redact)
    },
    [id, version, redact],
  )

  const update = useCallback(
    (patch: Partial<TData>) => {
      dirty.current = true
      const merged = { ...dataRef.current, ...patch }
      dataRef.current = merged
      setData(merged)
      persist(stepRef.current.id, merged)

      // Correcting a field clears its complaint immediately; leaving the error
      // on screen while the value is already fixed reads as a broken form.
      setErrors((prev) => {
        const touched = Object.keys(patch)
        if (!touched.some((k) => k in prev)) return prev
        const next = { ...prev }
        for (const k of touched) delete next[k]
        return next
      })
      setCommitError(null)
    },
    [persist],
  )

  const advance = useCallback(
    (merged: TData) => {
      const list = enabledSteps(allSteps, merged)
      const at = list.findIndex((s) => s.id === stepRef.current.id)
      const target = list[at + 1]
      if (!target) return
      dirty.current = true
      setStepId(target.id)
      setErrors({})
      setCommitError(null)
      persist(target.id, merged)
    },
    [allSteps, persist],
  )

  const next = useCallback(() => {
    if (busyRef.current) return
    const current = stepRef.current
    const found = current.validate?.(dataRef.current) ?? {}
    if (Object.keys(found).length > 0) {
      setErrors(found)
      return
    }
    setErrors({})

    if (!current.commit) {
      advance(dataRef.current)
      return
    }

    busyRef.current = true
    setBusy(true)
    setCommitError(null)
    void current
      .commit(dataRef.current)
      .then((patch) => {
        const merged = patch ? { ...dataRef.current, ...patch } : dataRef.current
        dataRef.current = merged
        setData(merged)
        advance(merged)
      })
      .catch((err: unknown) => {
        // Stay on the step. The remedy belongs next to the field the retailer
        // would have to change, not on a screen they have already left.
        setCommitError(errorKey(err))
      })
      .finally(() => {
        busyRef.current = false
        setBusy(false)
      })
  }, [advance])

  const leavePolicy: LeavePolicy = useMemo(() => {
    if (step.leave) return step.leave(data)
    if (step.terminal) return 'free'
    return dirty.current ? 'confirm' : 'free'
  }, [step, data])

  const back = useCallback(() => {
    if (busyRef.current) return
    const current = stepRef.current
    if (current.leave?.(dataRef.current) === 'blocked') return
    const list = enabledSteps(allSteps, dataRef.current)
    const at = list.findIndex((s) => s.id === current.id)
    const target = list[at - 1]
    if (!target) return
    setStepId(target.id)
    setErrors({})
    setCommitError(null)
    persist(target.id, dataRef.current)
  }, [allSteps, persist])

  const abandon = useCallback(() => {
    clearDraft(id)
    dirty.current = false
    busyRef.current = false
    dataRef.current = initialData
    setData(initialData)
    setStepId(allSteps[0].id)
    setErrors({})
    setCommitError(null)
    setBusy(false)
  }, [id, initialData, allSteps])

  const context = useMemo(
    () => ({ data, update, errors, commitError, busy, next, back }),
    [data, update, errors, commitError, busy, next, back],
  )

  return {
    data,
    steps,
    step,
    index,
    resumed,
    errors,
    commitError,
    busy,
    next,
    back,
    update,
    abandon,
    leavePolicy,
    context,
  }
}
