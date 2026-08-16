import { useTranslation } from 'react-i18next'
import { EmptyState, Metric, MetricGrid, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatMoney, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getCommissionStatement } from './counterApi'
import './counter.css'

/**
 * The statement behind the commission summary.
 *
 * `commission` answers "how much have I earned". This answers "where did it
 * go" — and the settlement reference is the whole reason it exists, because
 * that is the thing a retailer quotes when they ring the zonal office. A
 * period with no reference is one nobody has paid yet, and the screen says so
 * rather than leaving a blank column.
 */
export default function CommissionStatementPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const statement = useResource('commission.statement', getCommissionStatement)

  if (!can('commission.statement')) {
    return <LockedService titleKey="item.commissionStatement" capability="commission.statement" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.commissionStatement')}</h1>
        <p className="screen__lede">{t('statement.lede')}</p>
      </header>

      <ResourceView
        resource={statement}
        skeletonRows={4}
        isEmpty={(data) => data.lines.length === 0}
        empty={<EmptyState icon="coin" title={t('statement.emptyTitle')} />}
      >
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric
                strong
                label={t('statement.totalEarned')}
                value={formatMoney(data.totalEarned, lang)}
              />
              <Metric
                label={t('statement.totalPaid')}
                value={formatMoney(data.totalPaid, lang)}
                hint={t('statement.unpaidHint', {
                  amount: formatMoney(data.totalEarned - data.totalPaid, lang),
                })}
              />
            </MetricGrid>

            <Panel title={t('statement.byPeriod')}>
              <ul className="ledger">
                {data.lines.map((line) => (
                  <li className="ledger__item" key={line.period}>
                    <div className="ledger__body">
                      <p className="ledger__title">{line.label[lang]}</p>
                      {line.reference ? (
                        <p className="ledger__id identifier">{line.reference}</p>
                      ) : (
                        <p className="ledger__id">{t('statement.noReference')}</p>
                      )}
                    </div>
                    <div className="ledger__right">
                      <p className="ledger__amount">{formatMoney(line.earned, lang)}</p>
                      <StatusPill
                        tone={line.status === 'paid' ? 'ok' : 'warn'}
                        label={t(`statement.status.${line.status}`)}
                      />
                    </div>
                    {line.paidOn && (
                      <p className="ledger__meta">
                        {t('statement.paidOn', { date: formatDate(line.paidOn, lang) })}
                      </p>
                    )}
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
