import { useTranslation } from 'react-i18next'
import { Metric, MetricGrid, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getPerformance } from './opsApi'
import './ops.css'

const TREND_GLYPH = { up: '▲', down: '▼', flat: '—' } as const

/**
 * The outlet scorecard.
 *
 * Trend is a glyph and a word, never an arrow alone: ▲ and ▼ differ by
 * orientation, which is the first thing lost on a scratched counter phone in
 * daylight, and by colour, which is the second.
 */
export default function PerformancePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const performance = useResource('performance', getPerformance)

  if (!can('report.performance')) {
    return <LockedService titleKey="item.performance" capability="report.performance" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.performance')}</h1>
        <p className="screen__lede">{t('perf.lede')}</p>
      </header>

      <ResourceView resource={performance} skeletonRows={4}>
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric
                strong
                label={t('perf.overall')}
                value={formatQuantity(data.overall, lang)}
                hint={data.period[lang]}
              />
              {data.rank !== undefined && data.ofOutlets !== undefined && (
                <Metric
                  label={t('perf.rank')}
                  value={`${formatQuantity(data.rank, lang)} / ${formatQuantity(data.ofOutlets, lang)}`}
                  hint={t('perf.rankHint')}
                />
              )}
            </MetricGrid>

            <Panel title={t('perf.scores')}>
              {data.scores.map((score) => {
                const pct = Math.round((score.score / score.max) * 100)
                return (
                  <div className="target" key={score.code}>
                    <div className="target__head">
                      <p className="batch__name">{score.label[lang]}</p>
                      <StatusPill
                        tone={pct >= 80 ? 'ok' : pct >= 60 ? 'warn' : 'danger'}
                        label={`${TREND_GLYPH[score.trend]} ${t(`perf.trend.${score.trend}`)}`}
                      />
                    </div>
                    <p className="target__figures">
                      {formatQuantity(score.score, lang)}{' '}
                      <span className="batch__unit">/ {formatQuantity(score.max, lang)}</span>
                    </p>
                    <div className="target__track" aria-hidden="true">
                      <span
                        className={`target__fill${pct >= 80 ? ' target__fill--met' : ''}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}
