import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterChips, Metric, MetricGrid, Panel, ResourceView } from '../../components/data'
import { formatDate, formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { getSales } from './counterApi'
import type { Period, SalesPoint } from './counterTypes'
import './counter.css'

const PERIODS: Period[] = ['today', 'week', 'month']

export default function SalesReportPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [period, setPeriod] = useState<Period>('week')

  const sales = useResource(`sales:${period}`, (signal) => getSales(period, signal))

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.salesReport')}</h1>
        <p className="screen__lede">{t('sales.lede')}</p>
      </header>

      <FilterChips
        legend={t('data.period')}
        options={PERIODS.map((p) => ({ value: p, label: t(`period.${p}`) }))}
        value={period}
        onChange={(v) => setPeriod(v as Period)}
      />

      <ResourceView resource={sales} skeletonRows={3}>
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric
                strong
                label={t('sales.activations')}
                value={formatQuantity(data.activations, lang)}
                hint={
                  data.target
                    ? t('sales.ofTarget', { target: data.target })
                    : undefined
                }
              />
              <Metric
                label={t('sales.recharges')}
                value={formatQuantity(data.recharges, lang)}
                hint={formatMoney(data.rechargeAmount, lang)}
              />
              <Metric label={t('item.commission')} value={formatMoney(data.commission, lang)} />
            </MetricGrid>

            <Panel title={t('sales.daily')}>
              <DailyBars points={data.points} lang={lang} />
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}

/**
 * Nine bars drawn in CSS.
 *
 * A charting library is 40 kB of JavaScript in a bundle a retailer downloads
 * over 2G, to draw something a flexbox already draws. The table underneath is
 * not a fallback — it is the accessible reading of the same data, and a screen
 * reader gets numbers rather than a shrug.
 */
function DailyBars({ points, lang }: { points: SalesPoint[]; lang: Lang }) {
  const { t } = useTranslation()
  const peak = Math.max(1, ...points.map((p) => p.activations))

  return (
    <>
      <div className="bars" aria-hidden="true">
        {points.map((point) => (
          <div className="bars__col" key={point.day}>
            <span
              className="bars__bar"
              style={{ height: `${Math.round((point.activations / peak) * 100)}%` }}
            />
            <span className="bars__label">
              {formatQuantity(new Date(point.day).getDate(), lang)}
            </span>
          </div>
        ))}
      </div>

      {/* The wrapper carries `visually-hidden`, not the table. A table ignores
          a width smaller than its own min-content, so the utility applied
          directly to it left a 336px table on a 320px screen. */}
      <div className="visually-hidden">
        <table>
          <caption>{t('sales.daily')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('sales.day')}</th>
              <th scope="col">{t('sales.activations')}</th>
              <th scope="col">{t('sales.rechargeAmount')}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((point) => (
              <tr key={point.day}>
                <th scope="row">{formatDate(point.day, lang)}</th>
                <td>{formatQuantity(point.activations, lang)}</td>
                <td>{formatMoney(point.rechargeAmount, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
