import { useTranslation } from 'react-i18next'
import { EmptyState, Metric, MetricGrid, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatMoney, formatQuantity, formatRelativeDay, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getSrRoute } from './liftingApi'
import type { StopStatus } from './liftingTypes'
import './lifting.css'

const STATUS_TONE: Record<StopStatus, 'ok' | 'muted' | 'warn'> = {
  visited: 'ok',
  pending: 'muted',
  skipped: 'warn',
}

/**
 * The route a sales representative runs today.
 *
 * Outstanding balance sits on the stop rather than in a separate report,
 * because it is the reason the SR is standing there — a visit that does not
 * collect what is owed is a visit that has to happen again.
 */
export default function SrRoutePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const route = useResource('sr.route', getSrRoute)

  if (!can('sr.route')) {
    return <LockedService titleKey="item.srRoute" capability="sr.route" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.srRoute')}</h1>
        <p className="screen__lede">{t('sr.routeLede')}</p>
      </header>

      <ResourceView
        resource={route}
        skeletonRows={4}
        isEmpty={(data) => data.stops.length === 0}
        empty={<EmptyState icon="route" title={t('sr.emptyTitle')} body={t('sr.emptyBody')} />}
      >
        {(data) => {
          const visited = data.stops.filter((s) => s.status === 'visited').length
          const due = data.stops.reduce((sum, s) => sum + (s.outstanding ?? 0), 0)
          return (
            <>
              <MetricGrid label={t('home.summary')}>
                <Metric
                  strong
                  label={t('sr.visited')}
                  value={`${formatQuantity(visited, lang)} / ${formatQuantity(data.stops.length, lang)}`}
                  hint={formatDate(data.date, lang)}
                />
                <Metric label={t('sr.outstanding')} value={formatMoney(due, lang)} />
              </MetricGrid>

              <Panel title={`${data.srName[lang]} · ${t('sr.stops')}`}>
                <ul className="stops">
                  {data.stops.map((stop) => (
                    <li className="stop" key={stop.posCode}>
                      <div className="stop__main">
                        <p className="stop__name">{stop.name[lang]}</p>
                        <p className="stop__meta">
                          <span className="identifier">{stop.posCode}</span> ·{' '}
                          {stop.address[lang]}
                        </p>
                        {stop.lastVisitedOn && (
                          <p className="stop__meta">
                            {t('sr.lastVisit', {
                              when: formatRelativeDay(stop.lastVisitedOn, lang, {
                                today: t('data.today'),
                                yesterday: t('data.yesterday'),
                              }),
                            })}
                          </p>
                        )}
                      </div>
                      <div className="stop__right">
                        <StatusPill
                          tone={STATUS_TONE[stop.status]}
                          label={t(`sr.status.${stop.status}`)}
                        />
                        {stop.outstanding ? (
                          <span className="stop__due">{formatMoney(stop.outstanding, lang)}</span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )
        }}
      </ResourceView>
    </div>
  )
}
