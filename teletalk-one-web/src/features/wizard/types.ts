import type { ReactNode } from 'react'

/**
 * The multi-step engine every counter transaction runs on.
 *
 * Five SIM flows — activation, replacement, MNP port-in, ownership change and
 * plan migration — are the *same* transaction with different steps, different
 * validation and a different endpoint. They are expressed as configuration
 * here; `flows.test.tsx` fails the build if any of them needs an engine change.
 *
 * Three properties are load-bearing and are what separates this from a
 * `useState` step counter:
 *
 *  1. **Resumable.** A counter phone loses its browser tab to an incoming call
 *     mid-e-SAF. The draft survives a reload (see `draft.ts`).
 *  2. **Step-validated.** A step declares its own validation, so the engine
 *     never has to know what an NID is.
 *  3. **Abandonable, with a policy.** After the CBS request has been accepted
 *     the customer's SIM is live; going back to edit the e-SAF would be a lie.
 *     Steps declare whether leaving them is free, needs confirmation, or is
 *     impossible.
 */

/** Field name → `error.*` i18n key. Empty means the step is valid. */
export type FieldErrors = Record<string, string>

/**
 * `free`    — leave silently (nothing entered yet, or nothing at risk).
 * `confirm` — ask first; unsaved customer data would be lost.
 * `blocked` — refuse; the transaction is already committed downstream.
 */
export type LeavePolicy = 'free' | 'confirm' | 'blocked'

export interface StepContext<TData> {
  data: TData
  /** Shallow patch. Clears the error on every field the patch touches. */
  update: (patch: Partial<TData>) => void
  /** Only populated after the step has been submitted once. */
  errors: FieldErrors
  /** The step tried to commit and the server refused — an `error.*` key. */
  commitError: string | null
  busy: boolean
  next: () => void
  back: () => void
}

export interface WizardStep<TData> {
  id: string
  /** i18n key for the label in the step rail. */
  labelKey: string
  /**
   * Runs before the step may be left forwards. The engine shows whatever this
   * returns; it never inspects the values.
   */
  validate?: (data: TData) => FieldErrors
  /** Defaults to `confirm` once anything has been entered. */
  leave?: (data: TData) => LeavePolicy
  /** A step that returns false is skipped — how "recharge later" is expressed. */
  enabled?: (data: TData) => boolean
  /**
   * The server call this step owns. Runs after `validate` passes and before the
   * engine advances; the returned patch is merged into the draft, which is how
   * a step records the MSISDN CBS assigned. Throw to stay on the step — the
   * thrown value is mapped onto `commitError` via `errorKey()`.
   */
  commit?: (data: TData) => Promise<Partial<TData> | void>
  /** Overrides the footer's forward label, e.g. "Activate SIM". */
  nextLabelKey?: string
  /** End of the line: no footer, no back, no abandon prompt. */
  terminal?: boolean
  render: (ctx: StepContext<TData>) => ReactNode
}

export interface WizardConfig<TData> {
  /** Namespaces the draft. One in-flight draft per flow per tab. */
  id: string
  /** Bump when `TData` changes shape; older drafts are then discarded. */
  version: number
  /** i18n key for the flow's own heading. */
  titleKey: string
  initialData: TData
  steps: WizardStep<TData>[]
  /**
   * Fields that must never reach storage — biometric templates and OTPs. The
   * draft is written to sessionStorage on a shared counter terminal, so this
   * list is a privacy control, not an optimisation.
   */
  redact?: readonly (keyof TData)[]
}

export interface WizardState<TData> {
  data: TData
  /** Steps left after `enabled` is applied, in order. */
  steps: WizardStep<TData>[]
  step: WizardStep<TData>
  index: number
  /** True when this mount picked up a draft left by an earlier one. */
  resumed: boolean
  errors: FieldErrors
  commitError: string | null
  busy: boolean
  next: () => void
  back: () => void
  update: (patch: Partial<TData>) => void
  /** Discards the draft and returns to step one. */
  abandon: () => void
  leavePolicy: LeavePolicy
  context: StepContext<TData>
}

export type StepRenderer<TData> = (ctx: StepContext<TData>) => ReactNode
