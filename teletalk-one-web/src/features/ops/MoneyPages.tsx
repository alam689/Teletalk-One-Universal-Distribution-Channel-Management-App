import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Select } from '../../components/ui'
import {
  DataRow,
  EmptyState,
  Metric,
  MetricGrid,
  Panel,
  ResourceView,
  StatusPill,
} from '../../components/data'
import {
  formatDate,
  formatDateTime,
  formatIdentifier,
  formatMoney,
  type Lang,
} from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { getSettlements, getSubsidy, getWallet, queueCollection } from './opsApi'
import type { CollectionMethod } from './opsTypes'
import './ops.css'

/**
 * The four money screens. One file because they are four views of the same
 * question — what is owed, to whom, and has it moved yet — and splitting them
 * would have produced four copies of the same twenty lines.
 */

/* -------------------------------- wallet -------------------------------- */

export function WalletPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const wallet = useResource('wallet', getWallet)

  if (!can('wallet.view')) return <LockedService titleKey="item.wallet" capability="wallet.view" />

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.wallet')}</h1>
        <p className="screen__lede">{t('wallet.lede')}</p>
      </header>

      <ResourceView resource={wallet} skeletonRows={4}>
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric strong label={t('wallet.balance')} value={formatMoney(data.balance, lang)} />
              {data.creditLimit !== undefined && (
                <Metric
                  label={t('wallet.creditLimit')}
                  value={formatMoney(data.creditLimit, lang)}
                  hint={t('wallet.headroom', {
                    amount: formatMoney(data.balance + data.creditLimit, lang),
                  })}
                />
              )}
            </MetricGrid>

            <Panel title={t('wallet.ledger')}>
              <ul className="ledger">
                {data.entries.map((entry) => (
                  <li className="ledger__item" key={entry.id}>
                    <div className="ledger__body">
                      <p className="ledger__title">{t(`wallet.kind.${entry.kind}`)}</p>
                      {entry.reference && (
                        <p className="ledger__id identifier">{entry.reference}</p>
                      )}
                    </div>
                    <div className="ledger__right">
                      {/* Sign is carried by the glyph, not only by colour. */}
                      <p className="ledger__amount">
                        {entry.amount < 0 ? '−' : '+'}
                        {formatMoney(Math.abs(entry.amount), lang)}
                      </p>
                      <span className="batch__unit">
                        {t('wallet.after', { amount: formatMoney(entry.balanceAfter, lang) })}
                      </span>
                    </div>
                    <p className="ledger__meta">{formatDateTime(entry.at, lang)}</p>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}

/* ------------------------------- collection ------------------------------ */

const METHODS: CollectionMethod[] = ['cash', 'bank', 'mfs']

export function PaymentCollectPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const [fromPosCode, setFrom] = useState('')
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<CollectionMethod>('cash')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  if (!can('payment.collect')) {
    return <LockedService titleKey="item.paymentCollect" capability="payment.collect" />
  }

  const reset = () => {
    setOutboxId(null)
    setFrom('')
    setAmount('')
    setReference('')
  }

  const submit = () => {
    if (fromPosCode.length !== 8) return setError('error.posLength')
    const value = Number(formatIdentifier(amount)) || 0
    if (value <= 0) return setError('error.amountRequired')
    // A bank or MFS collection without a reference cannot be reconciled, and
    // an unreconcilable collection is an argument three weeks later.
    if (method !== 'cash' && reference.trim().length < 4) return setError('error.referenceRequired')
    setError(null)
    const queued = queueCollection({
      fromPosCode,
      amount: value,
      method,
      reference: reference.trim() || undefined,
    })
    setOutboxId(queued.id)
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.paymentCollect')}</h1>
        <p className="screen__lede">{t('collect.lede')}</p>
      </header>

      <Panel>
        {outboxId ? (
          <OutcomePanel outboxId={outboxId} doneKey="collect.done" onAgain={reset} />
        ) : (
          <div className="form">
            <Field
              id="fromPosCode"
              label={t('collect.from')}
              help={t('collect.fromHelp')}
              identifier
              inputMode="numeric"
              maxLength={8}
              value={fromPosCode}
              onChange={(e) => {
                setError(null)
                setFrom(formatIdentifier(e.target.value))
              }}
            />
            <Field
              id="collectAmount"
              label={t('flow.amount')}
              identifier
              inputMode="numeric"
              maxLength={7}
              value={amount}
              onChange={(e) => {
                setError(null)
                setAmount(formatIdentifier(e.target.value))
              }}
            />
            <Select
              id="method"
              label={t('collect.method')}
              value={method}
              onChange={(e) => {
                setError(null)
                setMethod(e.target.value as CollectionMethod)
              }}
              options={METHODS.map((m) => ({ value: m, label: t(`collect.methodName.${m}`) }))}
            />
            {method !== 'cash' && (
              <Field
                id="collectReference"
                label={t('collect.reference')}
                help={t('collect.referenceHelp')}
                identifier
                value={reference}
                onChange={(e) => {
                  setError(null)
                  setReference(e.target.value)
                }}
              />
            )}
            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={submit}>{t('collect.submit')}</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------ settlement ------------------------------ */

export function SettlementPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const settlements = useResource('settlements', getSettlements)

  if (!can('settlement.view')) {
    return <LockedService titleKey="item.settlement" capability="settlement.view" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.settlement')}</h1>
        <p className="screen__lede">{t('settlement.lede')}</p>
      </header>

      <ResourceView
        resource={settlements}
        skeletonRows={3}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon="scale" title={t('settlement.emptyTitle')} />}
      >
        {(data) =>
          data.map((row) => (
            <Panel key={row.id} title={row.period[lang]}>
              <div className="campaign__head">
                <StatusPill
                  tone={row.status === 'settled' ? 'ok' : 'warn'}
                  label={t(`statement.status.${row.status === 'settled' ? 'paid' : 'pending'}`)}
                />
                <span className="campaign__dates identifier">{row.id}</span>
              </div>
              <dl className="datalist">
                <DataRow label={t('settlement.gross')} value={formatMoney(row.grossSales, lang)} />
                <DataRow label={t('item.commission')} value={formatMoney(row.commission, lang)} />
                {/* Deductions are shown as their own line, never netted away
                    quietly — this is the figure outlets dispute. */}
                <DataRow
                  label={t('settlement.deductions')}
                  value={`− ${formatMoney(row.deductions, lang)}`}
                />
                <DataRow label={t('settlement.net')} value={formatMoney(row.net, lang)} />
                {row.settledOn && (
                  <DataRow
                    label={t('settlement.settledOn')}
                    value={formatDate(row.settledOn, lang)}
                  />
                )}
                {row.reference && (
                  <DataRow label={t('settlement.reference')} value={row.reference} id />
                )}
              </dl>
            </Panel>
          ))
        }
      </ResourceView>
    </div>
  )
}

/* -------------------------------- subsidy ------------------------------- */

export function SubsidyPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const subsidy = useResource('subsidy', getSubsidy)

  if (!can('subsidy.view')) {
    return <LockedService titleKey="item.subsidy" capability="subsidy.view" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.subsidy')}</h1>
        <p className="screen__lede">{t('subsidy.lede')}</p>
      </header>

      <ResourceView resource={subsidy} skeletonRows={3}>
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric strong label={t('subsidy.total')} value={formatMoney(data.total, lang)} />
              <Metric label={t('statement.status.paid')} value={formatMoney(data.paid, lang)} />
              <Metric label={t('statement.status.pending')} value={formatMoney(data.pending, lang)} />
            </MetricGrid>

            <Panel title={t('subsidy.items')}>
              <ul className="ledger">
                {data.items.map((item) => (
                  <li className="ledger__item" key={item.code}>
                    <div className="ledger__body">
                      <p className="ledger__title">{item.label[lang]}</p>
                      <p className="ledger__id">
                        {t(`subsidy.basis.${item.basis}`, {
                          rate: formatMoney(item.rate, lang),
                        })}
                      </p>
                    </div>
                    <div className="ledger__right">
                      <p className="ledger__amount">{formatMoney(item.earned, lang)}</p>
                      <StatusPill
                        tone={item.status === 'paid' ? 'ok' : 'warn'}
                        label={t(`statement.status.${item.status}`)}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}
