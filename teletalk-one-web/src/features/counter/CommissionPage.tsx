import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DataRow, FilterChips, Metric, MetricGrid, Panel, ResourceView } from '../../components/data'
import { formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { getCommission } from './counterApi'
import type { Period } from './counterTypes'
import './counter.css'

const PERIODS: Period[] = ['today', 'week', 'month']

/**
 * Commission, split into paid and pending.
 *
 * The split is the whole screen. "Total earned" is the number the retailer
 * already believes; **pending** is the number they ring the zonal office
 * about, and showing only a total is what generates that call.
 */
export default function CommissionPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [period, setPeriod] = useState<Period>('today')

  const commission = useResource(`commission:${period}`, (signal) =>
    getCommission(period, signal),
  )

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.commission')}</h1>
        <p className="screen__lede">{t('commission.lede')}</p>
      </header>

      <FilterChips
        legend={t('data.period')}
        options={PERIODS.map((p) => ({ value: p, label: t(`period.${p}`) }))}
        value={period}
        onChange={(v) => setPeriod(v as Period)}
      />

      <ResourceView resource={commission} skeletonRows={3}>
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric strong label={t('commission.total')} value={formatMoney(data.total, lang)} />
              <Metric label={t('commission.paid')} value={formatMoney(data.paid, lang)} />
              <Metric
                label={t('commission.pending')}
                value={formatMoney(data.pending, lang)}
                hint={t('commission.pendingHint')}
              />
            </MetricGrid>

            <Panel title={t('commission.breakdown')}>
              <dl className="datalist">
                {data.lines.map((line) => (
                  <DataRow
                    key={line.code}
                    label={`${line.label[lang]} · ${formatQuantity(line.count, lang)}`}
                    value={formatMoney(line.amount, lang)}
                  />
                ))}
              </dl>
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}
