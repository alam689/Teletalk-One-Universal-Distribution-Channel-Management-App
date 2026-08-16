import type { WizardConfig, WizardStep } from '../wizard/types'
import { checkNid, queueTransaction } from './activationApi'
import {
  EMPTY_FLOW_DATA,
  toEsafRequest,
  type FlowData,
  type TransactionRequest,
} from './activationTypes'
import {
  validateBiometric,
  validateEsaf,
  validateExistingNumber,
  validateIdentity,
  validateSimSelection,
} from './esafValidation'
import type { FlowSpec, StepKind } from './flowSpec'
import {
  BiometricStep,
  DoneStep,
  EsafStep,
  IdentityStep,
  NumberStep,
  ReviewStep,
  SimStep,
} from './steps'

/**
 * Turns a `FlowSpec` into something `useWizard` can run.
 *
 * Everything flow-specific lives in the spec or in a validator; this file has
 * no `if (kind === 'activation')` outside the request builder, which is the
 * test that the abstraction is real rather than decorative.
 */

export interface FlowContext {
  posCode: string
  /** Injected so age validation is deterministic under test. */
  today?: Date
}

function buildRequest(spec: FlowSpec, data: FlowData, posCode: string): TransactionRequest {
  const carriesEsaf = spec.steps.includes('esaf')
  return {
    kind: spec.kind,
    posCode,
    simSerial: data.simSerial || undefined,
    msisdn: data.msisdn || undefined,
    productCode: data.productCode || undefined,
    donorOperator: data.donorOperator || undefined,
    reasonCode: data.reasonCode || undefined,
    esaf: carriesEsaf ? toEsafRequest(data) : undefined,
    biometric: data.biometric ?? undefined,
  }
}

/** Fills only what the retailer has not already typed — a correction survives. */
function prefillFrom(
  data: FlowData,
  record: Awaited<ReturnType<typeof checkNid>>,
): Partial<FlowData> {
  const keep = <K extends keyof FlowData>(field: K, value: FlowData[K]) =>
    data[field] ? {} : { [field]: value }

  return {
    simsOnNid: record.simsOnNid,
    nidVerifiedAt: new Date().toISOString(),
    ...keep('nameBn', record.nameBn),
    ...keep('nameEn', record.nameEn),
    ...keep('fatherNameBn', record.fatherNameBn),
    ...keep('motherNameBn', record.motherNameBn),
    ...keep('gender', record.gender),
    ...keep('division', record.division),
    ...keep('district', record.district),
    ...keep('upazila', record.upazila),
    ...keep('postCode', record.postCode),
    ...keep('addressLine', record.addressLine),
  }
}

function stepFor(kind: StepKind, spec: FlowSpec, ctx: FlowContext): WizardStep<FlowData> {
  const { posCode, today } = ctx
  const props = { spec, posCode }

  switch (kind) {
    case 'sim':
      return {
        id: 'sim',
        labelKey: 'flow.step.sim',
        // A replacement takes a SIM out of stock but sells no plan.
        validate: (d) => validateSimSelection(d, spec.kind === 'activation'),
        render: (c) => <SimStep ctx={c} {...props} />,
      }

    case 'number':
      return {
        id: 'number',
        labelKey: 'flow.step.number',
        validate: (d) =>
          validateExistingNumber(d, {
            teletalkOnly: spec.teletalkOnly,
            requireProduct: spec.kind === 'planMigration',
            requireReason: spec.kind === 'replacement',
            requireDonor: spec.kind === 'portIn',
          }),
        render: (c) => <NumberStep ctx={c} {...props} />,
      }

    case 'identity':
      return {
        id: 'identity',
        labelKey: 'flow.step.identity',
        validate: (d) => validateIdentity(d, today),
        // The EC/NID lookup. This is where the thirty minutes goes: the e-SAF
        // arrives prefilled from the national record instead of being re-typed
        // off the card at the counter.
        commit: async (d) => prefillFrom(d, await checkNid(d.nid, d.dateOfBirth)),
        render: (c) => <IdentityStep ctx={c} {...props} />,
      }

    case 'esaf':
      return {
        id: 'esaf',
        labelKey: 'flow.step.esaf',
        validate: (d) => validateEsaf(d, today),
        render: (c) => <EsafStep ctx={c} {...props} />,
      }

    case 'biometric':
      return {
        id: 'biometric',
        labelKey: 'flow.step.biometric',
        validate: validateBiometric,
        render: (c) => <BiometricStep ctx={c} {...props} />,
      }

    case 'review':
      return {
        id: 'review',
        labelKey: 'flow.step.review',
        nextLabelKey: `flow.submit.${spec.kind}`,
        // Everything typed so far is at stake, and none of it is recoverable
        // from the server — this is the step that must ask before it is left.
        leave: () => 'confirm',
        /**
         * Queues rather than sends. `queueTransaction` returns immediately with
         * an idempotency key; the done step subscribes to the entry. That is
         * what lets an activation be completed with the tower down and settle
         * exactly once when it comes back.
         *
         * Passing `d.outboxId` back in makes a second press of the button
         * return the same entry instead of queueing the work twice.
         */
        commit: (d) => {
          const entry = queueTransaction(buildRequest(spec, d, posCode), d.outboxId || undefined)
          return Promise.resolve({ outboxId: entry.id })
        },
        render: (c) => <ReviewStep ctx={c} {...props} />,
      }

    case 'done':
      return {
        id: 'done',
        labelKey: 'flow.step.done',
        terminal: true,
        leave: () => 'free',
        render: (c) => <DoneStep ctx={c} {...props} />,
      }
  }
}

export function buildFlow(spec: FlowSpec, ctx: FlowContext): WizardConfig<FlowData> {
  return {
    // Namespaced by outlet: a second retailer signing into the same terminal
    // must never inherit the first one's half-entered customer.
    id: `${spec.id}.${ctx.posCode}`,
    version: spec.version,
    titleKey: `item.${spec.id}`,
    initialData: { ...EMPTY_FLOW_DATA, rechargeWanted: spec.recharge },
    steps: spec.steps.map((kind) => stepFor(kind, spec, ctx)),
    // Biometric references identify a BVS capture and never reach storage.
    redact: ['biometric'],
  }
}
