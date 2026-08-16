import { useCallback, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui'
import { EmptyState, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatMoney, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth, useSession } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { findDeskSpec, type DeskSpec } from './deskSpec'
import { getRequests } from './liftingApi'
import { canAct, queueFor, stageTone } from './liftingStates'
import { NewDemandForm } from './NewDemandForm'
import { RequestDetail } from './RequestDetail'
import type { LiftingRequest } from './liftingTypes'
import './lifting.css'

/**
 * One screen for all eight desks of the lifting chain.
 *
 * The desk decides *which queue* you see; the state machine decides *what you
 * may do to it*. Neither is decided here, which is why a ninth desk would be
 * an entry in `deskSpec.ts` and nothing else.
 */
export default function LiftingDeskPage({ deskId }: { deskId: string }) {
  const spec = findDeskSpec(deskId)
  const { can } = useAuth()

  if (!spec) return <Navigate to="/404" replace />
  if (!can(spec.capability)) {
    return <LockedService titleKey={`item.${spec.id}`} capability={spec.capability} />
  }
  return <Desk spec={spec} />
}

function Desk({ spec }: { spec: DeskSpec }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const { can } = useAuth()

  const requests = useResource('lifting.requests', getRequests)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const { reload } = requests
  const refresh = useCallback(() => {
    setCreating(false)
    reload()
  }, [reload])

  const rows = useMemo(() => {
    if (!requests.data) return null
    // The dealer's own desks show everything they raised, at any stage: they
    // are waiting on six other people, and "where is it now" is the question
    // they opened the app to ask.
    if (spec.ownLedger) {
      return requests.data
        .filter((r) => r.dealerPosCode === session.posCode)
        .sort((a, b) => new Date(b.raisedOn).getTime() - new Date(a.raisedOn).getTime())
    }
    return queueFor(requests.data, spec.stage, can, session.posCode)
  }, [requests.data, spec, can, session.posCode])

  const selected = rows?.find((r) => r.id === selectedId) ?? null

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t(`item.${spec.id}`)}</h1>
        <p className="screen__lede">{t(`desk.lede.${spec.id}`)}</p>
      </header>

      {spec.canCreate && !creating && !selected && (
        <div>
          <Button onClick={() => setCreating(true)}>{t('lift.newDemand')}</Button>
        </div>
      )}

      {creating && (
        <Panel>
          <NewDemandForm onSettled={refresh} onCancel={() => setCreating(false)} />
        </Panel>
      )}

      {/* Both, side by side, from 1100px. Below that the stylesheet hides the
          list once something is open — there is no room for two columns on a
          counter phone, and there is no reason to throw the queue away on a
          desktop. */}
      <div className={`split${selected ? ' split--detail' : ''}`}>
        <div className="split__list">
          <Panel title={t(spec.ownLedger ? 'lift.myRequests' : 'lift.waitingOnYou')}>
            <ResourceView
              resource={{ ...requests, data: rows }}
              skeletonRows={4}
              isEmpty={(data) => data.length === 0}
              empty={
                <EmptyState
                  icon="check"
                  title={t('lift.emptyTitle')}
                  body={t(spec.ownLedger ? 'lift.emptyOwnBody' : 'lift.emptyQueueBody')}
                />
              }
            >
              {(data) => (
                <ul className="queue">
                  {data.map((request) => (
                    <QueueRow
                      key={request.id}
                      request={request}
                      lang={lang}
                      selected={request.id === selectedId}
                      onOpen={() => setSelectedId(request.id)}
                    />
                  ))}
                </ul>
              )}
            </ResourceView>
          </Panel>
        </div>

        {selected && (
          <Panel
            action={
              <Button variant="link" onClick={() => setSelectedId(null)}>
                {t('lift.backToQueue')}
              </Button>
            }
          >
            <RequestDetail
              request={selected}
              actionable={canAct(selected, can, session.posCode)}
              onSettled={refresh}
            />
          </Panel>
        )}
      </div>
    </div>
  )
}

function QueueRow({
  request,
  lang,
  selected,
  onOpen,
}: {
  request: LiftingRequest
  lang: Lang
  selected: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()
  return (
    <li>
      <button
        type="button"
        className={`queue__row${selected ? ' queue__row--on' : ''}`}
        aria-current={selected ? 'true' : undefined}
        onClick={onOpen}
      >
        <span className="queue__main">
          <span className="queue__id identifier">{request.id}</span>
          <span className="queue__dealer">{request.dealerName[lang]}</span>
          <span className="queue__meta">
            {formatDate(request.raisedOn, lang)} · {request.territory[lang]}
          </span>
        </span>
        <span className="queue__right">
          <span className="queue__value">{formatMoney(request.value, lang)}</span>
          <StatusPill tone={stageTone(request.stage)} label={t(`stage.${request.stage}`)} />
        </span>
      </button>
    </li>
  )
}
