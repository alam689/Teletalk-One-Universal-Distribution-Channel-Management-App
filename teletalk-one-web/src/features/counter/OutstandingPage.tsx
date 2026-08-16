import { useTranslation } from 'react-i18next'
import { Alert } from '../../components/ui'
import { EmptyState, Metric, MetricGrid, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getOutstanding } from './counterApi'
import './counter.css'

/**
 * What the outlet owes.
 *
 * Overdue is separated from total and stated in days, not just coloured red —
 * "৳88,000, three days late" is actionable in a way that a red number is not,
 * and it survives a counter screen in daylight where a hue does not.
 */
export default function OutstandingPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const outstanding = useResource('outstanding', getOutstanding)

  if (!can('outstanding.view')) {
    return <LockedService titleKey="item.outstanding" capability="outstanding.view" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.outstanding')}</h1>
        <p className="screen__lede">{t('due.lede')}</p>
      </header>

      <ResourceView
        resource={outstanding}
        skeletonRows={3}
        isEmpty={(data) => data.items.length === 0}
        empty={<EmptyState icon="check" title={t('due.emptyTitle')} body={t('due.emptyBody')} />}
      >
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric strong label={t('due.total')} value={formatMoney(data.total, lang)} />
              <Metric label={t('due.overdue')} value={formatMoney(data.overdue, lang)} />
              {data.creditLimit !== undefined && (
                <Metric
                  label={t('due.creditLimit')}
                  value={formatMoney(data.creditLimit, lang)}
                  hint={t('due.headroom', {
                    amount: formatMoney(Math.max(0, data.creditLimit - data.total), lang),
                  })}
                />
              )}
            </MetricGrid>

            {data.creditLimit !== undefined && data.total > data.creditLimit * 0.9 && (
              <Alert tone="warn">{t('due.nearLimit')}</Alert>
            )}

            <Panel title={t('due.items')}>
              <ul className="ledger">
                {data.items.map((item) => (
                  <li className="ledger__item" key={item.id}>
                    <div className="ledger__body">
                      <p className="ledger__title">{item.what[lang]}</p>
                      <p className="ledger__id identifier">{item.id}</p>
                    </div>
                    <div className="ledger__right">
                      <p className="ledger__amount">{formatMoney(item.amount, lang)}</p>
                      <StatusPill
                        tone={item.overdueDays > 0 ? 'danger' : 'muted'}
                        label={
                          item.overdueDays > 0
                            ? t('due.overdueBy', { count: item.overdueDays })
                            : t('due.notYetDue')
                        }
                      />
                    </div>
                    <p className="ledger__meta">
                      {t('due.dueOn', { date: formatDate(item.dueOn, lang) })}
                      {item.overdueDays > 0 &&
                        ` · ${formatQuantity(item.overdueDays, lang)} ${t('due.days')}`}
                    </p>
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
