import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Select } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { formatIdentifier, formatMoney, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { outbox } from '../../lib/outbox'
import { listProducts } from '../activation/activationApi'
import type { Product, RechargeResult } from '../activation/activationTypes'
import { useOutboxEntry } from '../outbox/useOutbox'
import type { StepContext } from '../wizard/types'
import type { SaleData } from './saleFlow'
import type { SaleSpec } from './saleSpec'

/**
 * The two step bodies for an over-the-counter sale. Components only, so that
 * `saleFlow.tsx` stays what it claims to be: configuration.
 */

function useProducts(enabled: boolean): Product[] {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    if (!enabled) return
    const controller = new AbortController()
    listProducts(controller.signal)
      .then(setProducts)
      .catch((err: unknown) => logger.warn('product list unavailable', { err }))
    return () => controller.abort()
  }, [enabled])
  return products
}

/* -------------------------------- details ------------------------------- */

export function DetailsStep({ ctx, spec }: { ctx: StepContext<SaleData>; spec: SaleSpec }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const products = useProducts(spec.product)
  const err = (field: string) => (ctx.errors[field] ? t(ctx.errors[field]) : undefined)

  return (
    <div className="wiz__section">
      <p className="wiz__note">{t(`sale.intro.${spec.id}`)}</p>

      {spec.requiresMsisdn && (
        <Field
          id="msisdn"
          label={t('flow.msisdn')}
          help={t('flow.msisdnTeletalkHelp')}
          placeholder="015XXXXXXXX"
          identifier
          inputMode="numeric"
          autoComplete="off"
          maxLength={11}
          value={ctx.data.msisdn}
          error={err('msisdn')}
          onChange={(e) => ctx.update({ msisdn: formatIdentifier(e.target.value) })}
        />
      )}

      {spec.product ? (
        <Select
          id="productCode"
          label={t('flow.plan')}
          placeholder={t('flow.choosePlan')}
          value={ctx.data.productCode}
          error={err('productCode')}
          onChange={(e) => {
            const product = products.find((p) => p.code === e.target.value)
            // The price is the server's, never the retailer's — a product sale
            // must not be an amount field wearing a plan name.
            ctx.update({
              productCode: e.target.value,
              amount: product ? String(product.price) : '',
            })
          }}
          options={products.map((p) => ({
            value: p.code,
            label: `${p.name[lang]} — ${formatMoney(p.price, lang)}`,
          }))}
        />
      ) : (
        <>
          <div className="wiz__chips">
            {(spec.denominations.length > 0 ? spec.denominations : [20, 50, 100, 200, 500]).map(
              (amount) => (
                <button
                  key={amount}
                  type="button"
                  className="wiz__chip"
                  aria-pressed={ctx.data.amount === String(amount)}
                  onClick={() => ctx.update({ amount: String(amount) })}
                >
                  {formatMoney(amount, lang)}
                </button>
              ),
            )}
          </div>

          {spec.denominations.length === 0 && (
            <Field
              id="amount"
              label={t('flow.amount')}
              help={t('flow.amountHelp')}
              identifier
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={ctx.data.amount}
              error={err('amount')}
              onChange={(e) => ctx.update({ amount: formatIdentifier(e.target.value) })}
            />
          )}
          {spec.denominations.length > 0 && ctx.errors.amount && (
            <p className="field__error" role="alert">
              {t(ctx.errors.amount)}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/* --------------------------------- done --------------------------------- */

function isRechargeResult(value: unknown): value is RechargeResult {
  return typeof value === 'object' && value !== null && 'balanceAfter' in value
}

export function DoneStep({ ctx, spec }: { ctx: StepContext<SaleData>; spec: SaleSpec }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const entry = useOutboxEntry(ctx.data.outboxId || null)
  const result = isRechargeResult(entry?.result) ? entry.result : null

  const settled = entry?.status === 'settled'
  const failed = entry?.status === 'failed'

  return (
    <div className="wiz__section">
      <div className="wiz__done">
        <span className={`wiz__doneIcon${settled ? '' : ' wiz__doneIcon--pending'}`}>
          <Icon name={settled ? 'check' : failed ? 'bell' : 'clock'} size={26} />
        </span>
        <h2 className="wiz__doneTitle">
          {settled
            ? t(`sale.done.${spec.id}`)
            : failed
              ? t('flow.failedTitle')
              : t('flow.queuedTitle')}
        </h2>
        {!settled && !failed && <p className="wiz__note">{t('flow.queuedBody')}</p>}
        {failed && <Alert tone="danger">{t(entry?.errorKey ?? 'error.generic')}</Alert>}
      </div>

      {settled && result && (
        <dl className="wiz__review">
          <div className="wiz__row">
            <dt>{t('flow.transactionId')}</dt>
            <dd className="identifier">{result.transactionId}</dd>
          </div>
          {result.msisdn && (
            <div className="wiz__row">
              <dt>{t('flow.msisdn')}</dt>
              <dd className="identifier">{result.msisdn}</dd>
            </div>
          )}
          <div className="wiz__row">
            <dt>{t('flow.amount')}</dt>
            <dd>{formatMoney(result.amount, lang)}</dd>
          </div>
          <div className="wiz__row">
            <dt>{t('sale.balanceAfter')}</dt>
            <dd>{formatMoney(result.balanceAfter, lang)}</dd>
          </div>
        </dl>
      )}

      {failed && (
        <Button variant="ghost" onClick={() => outbox.retry(ctx.data.outboxId)}>
          {t('flow.retry')}
        </Button>
      )}
    </div>
  )
}

