import { useTranslation } from 'react-i18next'
import { EmptyState, Panel, ResourceView, StatusPill, type StatusTone } from '../../components/data'
import { Icon } from '../../components/Icon'
import { formatDate, formatRelativeDay, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getMnpRequests } from './activationApi'
import type { MnpStatus } from './activationTypes'
import '../counter/counter.css'

const TONE: Record<MnpStatus, StatusTone> = {
  submitted: 'muted',
  withOperator: 'warn',
  approved: 'warn',
  rejected: 'danger',
  completed: 'ok',
}

/**
 * Port-in and port-out requests and where they have got to.
 *
 * MNP completes at the regulator's pace, not the counter's — the customer
 * comes back three days later to ask, and without this screen the retailer has
 * nothing to tell them but "wait". A rejected request carries the operator's
 * own reason, in both languages, because that is what gets read aloud.
 */
export default function MnpStatusPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const requests = useResource('mnp.requests', getMnpRequests)

  if (!can('mnp.status')) {
    return <LockedService titleKey="item.mnpStatus" capability="mnp.status" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.mnpStatus')}</h1>
        <p className="screen__lede">{t('mnp.lede')}</p>
      </header>

      <ResourceView
        resource={requests}
        skeletonRows={4}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon="portIn" title={t('mnp.emptyTitle')} body={t('mnp.emptyBody')} />}
      >
        {(data) => (
          <Panel title={t('mnp.requests')}>
            <ul className="ledger">
              {data.map((request) => (
                <li className="ledger__item" key={request.id}>
                  <span className="ledger__icon" aria-hidden="true">
                    <Icon name={request.direction === 'in' ? 'portIn' : 'portOut'} size={20} />
                  </span>
                  <div className="ledger__body">
                    <p className="ledger__title">
                      {t(request.direction === 'in' ? 'mnp.portIn' : 'mnp.portOut')}
                      {request.operator ? ` · ${request.operator}` : ''}
                    </p>
                    <p className="ledger__id identifier">{request.msisdn}</p>
                  </div>
                  <div className="ledger__right">
                    <StatusPill
                      tone={TONE[request.status]}
                      label={t(`mnp.status.${request.status}`)}
                    />
                  </div>
                  <p className="ledger__meta">
                    <span className="identifier">{request.id}</span> ·{' '}
                    {formatRelativeDay(request.raisedOn, lang, {
                      today: t('data.today'),
                      yesterday: t('data.yesterday'),
                    })}
                    {request.expectedBy &&
                      ` · ${t('mnp.expectedBy', { date: formatDate(request.expectedBy, lang) })}`}
                  </p>
                  {request.note && <p className="ledger__note">{request.note[lang]}</p>}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </ResourceView>
    </div>
  )
}
