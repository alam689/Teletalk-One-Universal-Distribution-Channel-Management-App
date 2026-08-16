import { useTranslation } from 'react-i18next'
import { Metric, MetricGrid, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getTarget } from './counterApi'
import type { TargetLine } from './counterTypes'
import './counter.css'

/**
 * Target and achievement for the month.
 *
 * Days left is a metric rather than a footnote, because it is the number that
 * changes what a retailer does on the 27th. Progress is a bar *and* a figure:
 * a bar alone cannot be read aloud down a phone to a field officer.
 */
export default function TargetPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const target = useResource('report.target', getTarget)

  if (!can('report.target')) {
    return <LockedService titleKey="item.target" capability="report.target" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.target')}</h1>
        <p className="screen__lede">{t('target.lede')}</p>
      </header>

      <ResourceView resource={target} skeletonRows={3}>
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric
                strong
                label={t('target.daysLeft')}
                value={formatQuantity(data.daysLeft, lang)}
                hint={t('target.thisMonth')}
              />
              <Metric
                label={t('target.metCount')}
                value={`${formatQuantity(
                  data.lines.filter((l) => l.achieved >= l.target).length,
                  lang,
                )} / ${formatQuantity(data.lines.length, lang)}`}
              />
            </MetricGrid>

            <Panel title={t('target.byLine')}>
              {data.lines.map((line) => (
                <TargetRow key={line.code} line={line} lang={lang} />
              ))}
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}

function TargetRow({ line, lang }: { line: TargetLine; lang: Lang }) {
  const { t } = useTranslation()
  const pct = line.target === 0 ? 0 : Math.round((line.achieved / line.target) * 100)
  const met = line.achieved >= line.target
  const show = (n: number) =>
    line.unit === 'money' ? formatMoney(n, lang) : formatQuantity(n, lang)

  return (
    <div className="target">
      <div className="target__head">
        <p className="batch__name">{line.label[lang]}</p>
        <StatusPill
          tone={met ? 'ok' : pct >= 80 ? 'warn' : 'muted'}
          label={t('target.percent', { pct })}
        />
      </div>
      <p className="target__figures">
        {show(line.achieved)} <span className="batch__unit">/ {show(line.target)}</span>
      </p>
      {/* Decorative: the figures above are the accessible reading. */}
      <div className="target__track" aria-hidden="true">
        <span
          className={`target__fill${met ? ' target__fill--met' : ''}`}
          style={{ width: `${Math.min(100, pct)}%` }}
        />
      </div>
    </div>
  )
}
