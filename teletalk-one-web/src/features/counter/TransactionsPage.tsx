import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EmptyState, FilterChips, Panel, ResourceView, StatusPill } from '../../components/data'
import { Icon } from '../../components/Icon'
import { formatMoney, formatRelativeDay, formatTime, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useOutboxEntries } from '../outbox/useOutbox'
import { getLedger } from './counterApi'
import type { LedgerEntry } from './counterTypes'
import {
  applyFilter,
  iconForKind,
  mergeLedger,
  queuedAsLedger,
  toneForState,
  type LedgerFilter,
} from './ledger'
import './counter.css'

/**
 * The transaction ledger — and the screen the offline outbox is finally
 * legible on. Anything still in the client's queue appears here, marked, so
 * "did that activation go through?" is a question the counter can answer
 * itself.
 */
export default function TransactionsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [filter, setFilter] = useState<LedgerFilter>('all')

  const ledger = useResource('ledger', getLedger)
  const queued = useOutboxEntries()

  const rows = useMemo(
    () => (ledger.data ? mergeLedger(ledger.data, queuedAsLedger(queued)) : null),
    [ledger.data, queued],
  )

  const filters: { value: LedgerFilter; label: string }[] = [
    { value: 'all', label: t('ledger.filterAll') },
    { value: 'activation', label: t('ledger.filterSim') },
    { value: 'recharge', label: t('ledger.filterRecharge') },
    { value: 'attention', label: t('ledger.filterAttention') },
  ]

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.transactions')}</h1>
        <p className="screen__lede">{t('ledger.lede')}</p>
      </header>

      <FilterChips
        legend={t('ledger.filterLegend')}
        options={filters}
        value={filter}
        onChange={(v) => setFilter(v as LedgerFilter)}
      />

      <Panel>
        <ResourceView
          resource={{ ...ledger, data: rows }}
          skeletonRows={5}
          isEmpty={(data) => applyFilter(data, filter).length === 0}
          empty={
            <EmptyState
              icon="list"
              title={t('ledger.emptyTitle')}
              body={t('ledger.emptyBody')}
            />
          }
        >
          {(data) => (
            <ul className="ledger">
              {applyFilter(data, filter).map((row) => (
                <LedgerRow key={row.id} row={row} lang={lang} />
              ))}
            </ul>
          )}
        </ResourceView>
      </Panel>
    </div>
  )
}

function LedgerRow({ row, lang }: { row: LedgerEntry; lang: Lang }) {
  const { t } = useTranslation()
  const day = formatRelativeDay(row.at, lang, {
    today: t('data.today'),
    yesterday: t('data.yesterday'),
  })

  return (
    <li className="ledger__item">
      <span className="ledger__icon" aria-hidden="true">
        <Icon name={iconForKind(row.kind)} size={20} />
      </span>

      <div className="ledger__body">
        <p className="ledger__title">{t(`flow.kind.${row.kind}`)}</p>
        {/* MSISDN and transaction id stay Latin and monospaced — both get
            dictated over the phone and matched against CBS. */}
        <p className="ledger__id identifier">{row.msisdn}</p>
      </div>

      <div className="ledger__right">
        {row.amount !== undefined && (
          <p className="ledger__amount">{formatMoney(row.amount, lang)}</p>
        )}
        <StatusPill
          tone={toneForState(row.state)}
          label={row.local ? t('ledger.stateQueued') : t(`ledger.state.${row.state}`)}
        />
      </div>

      <p className="ledger__meta">
        {day} · {formatTime(row.at, lang)}
        {!row.local && (
          <>
            {' · '}
            <span className="identifier">{row.id}</span>
          </>
        )}
      </p>

      {row.note && <p className="ledger__note">{row.note[lang]}</p>}
    </li>
  )
}
