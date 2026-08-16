import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field } from '../../components/ui'
import { EmptyState, Panel, ResourceView, StatusPill, type StatusTone } from '../../components/data'
import { formatDate, formatIdentifier, formatQuantity, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { useResource } from '../../lib/useResource'
import { useAuth, useSession } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { getLiftingProducts } from '../lifting/liftingApi'
import type { LiftingProduct } from '../lifting/liftingMock'
import { getRequisitions, queueRequisition, queueRequisitionAction } from './opsApi'
import type { Requisition, RequisitionStage } from './opsTypes'
import './ops.css'

const TONE: Record<RequisitionStage, StatusTone> = {
  raised: 'muted',
  approved: 'warn',
  fulfilled: 'ok',
  rejected: 'danger',
}

/**
 * Requisition, in two views from one component.
 *
 * `raise` is the outlet's own list plus a form; `approve` is the queue waiting
 * on the approver. It is the lifting chain's shape at a third of the length —
 * no deposit, no invoice, no revenue assurance, because no money moves between
 * the outlet and Teletalk here.
 */
export default function RequisitionPage({ mode }: { mode: 'raise' | 'approve' }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  // `useAuth`, not `useSession`: this component renders during the boot
  // restore, when there is no session yet, and `useSession` throws there.
  const { can, session } = useAuth()
  const posCode = session?.posCode ?? ''

  const capability = mode === 'raise' ? 'requisition.create' : 'requisition.approve'
  const titleKey = mode === 'raise' ? 'item.requisition' : 'item.requisitionApprove'

  const requisitions = useResource('requisitions', getRequisitions)
  const [creating, setCreating] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

  if (!can(capability)) return <LockedService titleKey={titleKey} capability={capability} />

  const rows = (data: Requisition[]) =>
    mode === 'raise'
      ? data.filter((r) => r.outletPosCode === posCode)
      : data.filter((r) => r.stage === 'raised')

  const open = requisitions.data?.find((r) => r.id === selected) ?? null

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t(titleKey)}</h1>
        <p className="screen__lede">
          {t(mode === 'raise' ? 'req.ledeRaise' : 'req.ledeApprove')}
        </p>
      </header>

      {mode === 'raise' && !creating && !open && (
        <div>
          <Button onClick={() => setCreating(true)}>{t('req.new')}</Button>
        </div>
      )}

      {creating && (
        <Panel>
          <NewRequisitionForm
            onDone={() => {
              setCreating(false)
              requisitions.reload()
            }}
            onCancel={() => setCreating(false)}
          />
        </Panel>
      )}

      <div className={`split${open ? ' split--detail' : ''}`}>
        <div className="split__list">
        <Panel title={t(mode === 'raise' ? 'req.mine' : 'lift.waitingOnYou')}>
          <ResourceView
            resource={requisitions}
            skeletonRows={3}
            isEmpty={(data) => rows(data).length === 0}
            empty={<EmptyState icon="list" title={t('lift.emptyTitle')} body={t('req.emptyBody')} />}
          >
            {(data) => (
              <ul className="queue">
                {rows(data).map((requisition) => (
                  <li key={requisition.id}>
                    <button
                      type="button"
                      className={`queue__row${
                        requisition.id === selected ? ' queue__row--on' : ''
                      }`}
                      aria-current={requisition.id === selected ? 'true' : undefined}
                      onClick={() => setSelected(requisition.id)}
                    >
                      <span className="queue__main">
                        <span className="queue__id identifier">{requisition.id}</span>
                        <span className="queue__dealer">{requisition.outletName[lang]}</span>
                        <span className="queue__meta">
                          {formatDate(requisition.raisedOn, lang)} ·{' '}
                          {t('req.lineCount', { count: requisition.lines.length })}
                        </span>
                      </span>
                      <span className="queue__right">
                        <StatusPill
                          tone={TONE[requisition.stage]}
                          label={t(`req.stage.${requisition.stage}`)}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ResourceView>
        </Panel>
        </div>

        {open && (
          <Panel
            action={
              <Button variant="link" onClick={() => setSelected(null)}>
                {t('lift.backToQueue')}
              </Button>
            }
          >
            <RequisitionDetail
              requisition={open}
              canApprove={mode === 'approve' && open.stage === 'raised'}
              onDone={() => {
                setSelected(null)
                requisitions.reload()
              }}
            />
          </Panel>
        )}
      </div>
    </div>
  )
}

/* ------------------------------- the form ------------------------------- */

function NewRequisitionForm({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const [products, setProducts] = useState<LiftingProduct[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getLiftingProducts(controller.signal)
      .then(setProducts)
      .catch((err: unknown) => logger.warn('products unavailable', { err }))
    return () => controller.abort()
  }, [])

  const total = products.reduce(
    (sum, p) => sum + (Number(formatIdentifier(quantities[p.code] ?? '')) || 0),
    0,
  )

  const submit = () => {
    if (total === 0) {
      setError('error.demandEmpty')
      return
    }
    setError(null)
    const queued = queueRequisition(
      {
        quantities: Object.fromEntries(
          products
            .map((p) => [p.code, Number(formatIdentifier(quantities[p.code] ?? '')) || 0] as const)
            .filter(([, q]) => q > 0),
        ),
        note: note.trim() || undefined,
      },
      session.posCode,
    )
    setOutboxId(queued.id)
  }

  if (outboxId) return <OutcomePanel outboxId={outboxId} doneKey="req.raised" onAgain={onDone} />

  return (
    <div className="form">
      <p className="wiz__legend">{t('req.new')}</p>
      <div className="wiz__grid">
        {products.map((p) => (
          <Field
            key={p.code}
            id={`req-${p.code}`}
            label={p.name[lang]}
            identifier
            inputMode="numeric"
            maxLength={5}
            value={quantities[p.code] ?? ''}
            onChange={(e) => {
              setError(null)
              setQuantities({ ...quantities, [p.code]: formatIdentifier(e.target.value) })
            }}
          />
        ))}
      </div>
      <Field
        id="reqNote"
        label={t('lift.note')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <p className="wiz__note">{t('req.totalUnits', { count: total })}</p>
      {error && <Alert tone="danger">{t(error)}</Alert>}
      <div className="form__actions">
        <Button onClick={submit}>{t('req.send')}</Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('wizard.cancel')}
        </Button>
      </div>
    </div>
  )
}

/* ------------------------------ the detail ------------------------------ */

function RequisitionDetail({
  requisition,
  canApprove,
  onDone,
}: {
  requisition: Requisition
  canApprove: boolean
  onDone: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const [approved, setApproved] = useState<Record<string, string>>(() =>
    Object.fromEntries(requisition.lines.map((l) => [l.productCode, String(l.approved ?? l.requested)])),
  )
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  const act = (action: 'approve' | 'reject') => {
    if (action === 'reject' && !note.trim()) {
      setError('error.reasonRequired')
      return
    }
    if (action === 'approve') {
      const over = requisition.lines.find(
        (l) => (Number(formatIdentifier(approved[l.productCode] ?? '')) || 0) > l.requested,
      )
      if (over) {
        setError('error.approvedAboveRequested')
        return
      }
    }
    setError(null)
    const queued = queueRequisitionAction(
      {
        requisitionId: requisition.id,
        action,
        approvedQuantities:
          action === 'approve'
            ? Object.fromEntries(
                Object.entries(approved).map(([code, value]) => [
                  code,
                  Number(formatIdentifier(value)) || 0,
                ]),
              )
            : undefined,
        note: note.trim() || undefined,
      },
      session.posCode,
    )
    setOutboxId(queued.id)
  }

  return (
    <div className="lift">
      <header className="lift__head">
        <div>
          <p className="lift__id identifier">{requisition.id}</p>
          <p className="lift__dealer">{requisition.outletName[lang]}</p>
        </div>
        <StatusPill
          tone={TONE[requisition.stage]}
          label={t(`req.stage.${requisition.stage}`)}
        />
      </header>

      <p className="wiz__legend">{t('lift.lines')}</p>
      <ul className="lift__lines">
        {requisition.lines.map((line) => (
          <li className="lift__line" key={line.productCode}>
            <span>{line.productName[lang]}</span>
            <span className="lift__qty">
              {line.approved !== undefined && line.approved !== line.requested ? (
                <>
                  <s className="lift__was">{formatQuantity(line.requested, lang)}</s>{' '}
                  {formatQuantity(line.approved, lang)}
                </>
              ) : (
                formatQuantity(line.approved ?? line.requested, lang)
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="wiz__legend">{t('lift.history')}</p>
      <ol className="timeline">
        {requisition.history.map((event, index) => (
          <li className="timeline__item" key={`${event.at}-${index}`}>
            <span className="timeline__dot" aria-hidden="true" />
            <p className="timeline__action">{t(`req.action.${event.action}`)}</p>
            <p className="timeline__actor">
              {event.actorName[lang]} <span className="identifier">{event.actorPosCode}</span>
            </p>
            <p className="timeline__at">{formatDate(event.at, lang)}</p>
            {event.note && <p className="timeline__note">{event.note}</p>}
          </li>
        ))}
      </ol>

      {outboxId ? (
        <OutcomePanel outboxId={outboxId} doneKey="lift.actionDone" onAgain={onDone} />
      ) : (
        canApprove && (
          <div className="form">
            <p className="wiz__legend">{t('lift.yourAction')}</p>
            {requisition.lines.map((line) => (
              <Field
                key={line.productCode}
                id={`approve-${line.productCode}`}
                label={line.productName[lang]}
                help={t('lift.requestedWas', { count: line.requested })}
                identifier
                inputMode="numeric"
                maxLength={5}
                value={approved[line.productCode] ?? ''}
                onChange={(e) => {
                  setError(null)
                  setApproved({
                    ...approved,
                    [line.productCode]: formatIdentifier(e.target.value),
                  })
                }}
              />
            ))}
            <Field
              id="approveNote"
              label={t('lift.note')}
              help={t('lift.noteHelp')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={() => act('approve')}>{t('req.action.approve')}</Button>
              <Button variant="ghost" onClick={() => act('reject')}>
                {t('req.action.reject')}
              </Button>
            </div>
          </div>
        )
      )}
    </div>
  )
}
