import { formatIdentifier } from '../../i18n/format'
import { queueRecharge } from '../activation/activationApi'
import { MAX_RECHARGE, MIN_RECHARGE, msisdnError } from '../activation/esafValidation'
import type { FieldErrors, WizardConfig } from '../wizard/types'
import { DetailsStep, DoneStep } from './saleSteps'
import type { SaleSpec } from './saleSpec'

/**
 * The over-the-counter sale, on the activation engine.
 *
 * Two steps and a receipt, but it inherits the parts that matter for free:
 * the idempotency key, the queue that holds it when the tower is down, and the
 * rule that nothing is reported as done until the server says so. A recharge
 * screen written from scratch is exactly where a double charge comes from.
 */

export interface SaleData {
  msisdn: string
  amount: string
  productCode: string
  outboxId: string
}

export const EMPTY_SALE: SaleData = { msisdn: '', amount: '', productCode: '', outboxId: '' }

function validate(data: SaleData, spec: SaleSpec): FieldErrors {
  const errors: FieldErrors = {}

  if (spec.requiresMsisdn) {
    const msisdn = msisdnError(data.msisdn, true)
    if (msisdn) errors.msisdn = msisdn
  }

  // A product sale carries the server's price, not a typed amount, so there is
  // no amount to validate — only that a plan was actually chosen.
  if (spec.product) {
    if (!data.productCode) errors.productCode = 'error.productRequired'
    return errors
  }

  const raw = formatIdentifier(data.amount)
  if (!raw) errors.amount = 'error.amountRequired'
  else if (!/^\d+$/.test(raw)) errors.amount = 'error.amountDigits'
  else {
    const amount = Number(raw)
    if (spec.denominations.length > 0 && !spec.denominations.includes(amount)) {
      // A powerload pack that is not on the list does not exist, so this is a
      // different failure from "out of range" and gets its own remedy.
      errors.amount = 'error.amountDenomination'
    } else if (amount < MIN_RECHARGE || amount > MAX_RECHARGE) {
      errors.amount = 'error.amountRange'
    }
  }

  return errors
}

/* -------------------------------- config -------------------------------- */

export function buildSaleFlow(spec: SaleSpec, posCode: string): WizardConfig<SaleData> {
  return {
    id: `${spec.id}.${posCode}`,
    version: spec.version,
    titleKey: `item.${spec.id}`,
    initialData: EMPTY_SALE,
    steps: [
      {
        id: 'details',
        labelKey: 'sale.step.details',
        nextLabelKey: `sale.submit.${spec.id}`,
        validate: (d) => validate(d, spec),
        commit: (d) => {
          const entry = queueRecharge(
            {
              msisdn: spec.requiresMsisdn ? d.msisdn : undefined,
              amount: Number(formatIdentifier(d.amount)),
              posCode,
              channel: spec.channel,
              productCode: spec.product ? d.productCode : undefined,
            },
            d.outboxId || undefined,
          )
          return Promise.resolve({ outboxId: entry.id })
        },
        render: (ctx) => <DetailsStep ctx={ctx} spec={spec} />,
      },
      {
        id: 'done',
        labelKey: 'flow.step.done',
        terminal: true,
        leave: () => 'free',
        render: (ctx) => <DoneStep ctx={ctx} spec={spec} />,
      },
    ],
  }
}
