import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Select } from '../../components/ui'
import { EmptyState, Panel, ResourceView, StatusPill, type StatusTone } from '../../components/data'
import { formatDateTime, formatIdentifier, formatQuantity, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { getComplaintCategories, getComplaints, queueComplaint } from './opsApi'
import type { Complaint, ComplaintCategory, ComplaintStatus } from './opsTypes'
import './ops.css'

const TONE: Record<ComplaintStatus, StatusTone> = {
  open: 'warn',
  inProgress: 'warn',
  resolved: 'ok',
  closed: 'muted',
}

/**
 * Raise a complaint, and track one.
 *
 * The tracking view **counts down to the SLA deadline** rather than up from
 * the raise time. Elapsed time is a fact; time remaining is the thing that
 * makes somebody act, and a breach shows as a breach rather than as arithmetic
 * the retailer has to do themselves.
 */
export default function ComplaintPage({ mode }: { mode: 'create' | 'track' }) {
  const { t } = useTranslation()
  const { can } = useAuth()
  const capability = mode === 'create' ? 'complaint.create' : 'complaint.track'
  const titleKey = mode === 'create' ? 'item.complaintCreate' : 'item.complaintTrack'

  if (!can(capability)) return <LockedService titleKey={titleKey} capability={capability} />

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t(titleKey)}</h1>
        <p className="screen__lede">
          {t(mode === 'create' ? 'complaint.ledeCreate' : 'complaint.ledeTrack')}
        </p>
      </header>
      {mode === 'create' ? <CreateForm /> : <TrackList />}
    </div>
  )
}

/* -------------------------------- create -------------------------------- */

function CreateForm() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [categories, setCategories] = useState<ComplaintCategory[]>([])
  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [msisdn, setMsisdn] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getComplaintCategories(controller.signal)
      .then(setCategories)
      .catch((err: unknown) => logger.warn('categories unavailable', { err }))
    return () => controller.abort()
  }, [])

  const chosen = categories.find((c) => c.code === category)

  const reset = () => {
    setOutboxId(null)
    setCategory('')
    setSubject('')
    setDetail('')
    setMsisdn('')
  }

  const submit = () => {
    if (!category) return setError('error.categoryRequired')
    if (subject.trim().length < 5) return setError('error.subjectRequired')
    if (detail.trim().length < 10) return setError('error.detailRequired')
    setError(null)
    const queued = queueComplaint({
      category,
      subject: subject.trim(),
      detail: detail.trim(),
      msisdn: msisdn || undefined,
    })
    setOutboxId(queued.id)
  }

  if (outboxId) {
    return (
      <Panel>
        <OutcomePanel outboxId={outboxId} doneKey="complaint.raised" onAgain={reset} />
      </Panel>
    )
  }

  return (
    <Panel>
      <div className="form">
        <Select
          id="category"
          label={t('complaint.category')}
          placeholder={t('complaint.chooseCategory')}
          value={category}
          onChange={(e) => {
            setError(null)
            setCategory(e.target.value)
          }}
          options={categories.map((c) => ({ value: c.code, label: c.label[lang] }))}
        />
        {/* The SLA is stated before the ticket is raised, not discovered on the
            tracking screen afterwards. */}
        {chosen && (
          <p className="wiz__note">{t('complaint.slaNote', { count: chosen.slaHours })}</p>
        )}

        <Field
          id="subject"
          label={t('complaint.subject')}
          help={t('complaint.subjectHelp')}
          value={subject}
          onChange={(e) => {
            setError(null)
            setSubject(e.target.value)
          }}
        />
        <Field
          id="detail"
          label={t('complaint.detail')}
          help={t('complaint.detailHelp')}
          value={detail}
          onChange={(e) => {
            setError(null)
            setDetail(e.target.value)
          }}
        />
        <Field
          id="complaintMsisdn"
          label={t('complaint.msisdn')}
          help={t('complaint.msisdnHelp')}
          identifier
          inputMode="numeric"
          maxLength={11}
          value={msisdn}
          onChange={(e) => setMsisdn(formatIdentifier(e.target.value))}
        />

        {error && <Alert tone="danger">{t(error)}</Alert>}
        <div className="form__actions">
          <Button onClick={submit}>{t('complaint.send')}</Button>
        </div>
      </div>
    </Panel>
  )
}

/* --------------------------------- track -------------------------------- */

/** Hours remaining, negative once the SLA has blown. */
function hoursLeft(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000)
}

function TrackList() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const complaints = useResource('complaints', getComplaints)

  return (
    <Panel title={t('complaint.open')}>
      <ResourceView
        resource={complaints}
        skeletonRows={3}
        isEmpty={(data) => data.length === 0}
        empty={
          <EmptyState
            icon="ticket"
            title={t('complaint.emptyTitle')}
            body={t('complaint.emptyBody')}
          />
        }
      >
        {(data) => (
          <ul className="ledger">
            {data.map((complaint) => (
              <ComplaintRow key={complaint.id} complaint={complaint} lang={lang} />
            ))}
          </ul>
        )}
      </ResourceView>
    </Panel>
  )
}

function ComplaintRow({ complaint, lang }: { complaint: Complaint; lang: Lang }) {
  const { t } = useTranslation()
  const left = hoursLeft(complaint.slaDueOn)
  const settled = complaint.status === 'resolved' || complaint.status === 'closed'
  const breached = !settled && left < 0

  return (
    <li className="ledger__item">
      <div className="ledger__body">
        <p className="ledger__title">{complaint.subject}</p>
        <p className="ledger__id">
          {complaint.categoryLabel[lang]}
          {complaint.msisdn && (
            <>
              {' · '}
              <span className="identifier">{complaint.msisdn}</span>
            </>
          )}
        </p>
      </div>
      <div className="ledger__right">
        <StatusPill tone={TONE[complaint.status]} label={t(`complaint.status.${complaint.status}`)} />
        {!settled && (
          <StatusPill
            tone={breached ? 'danger' : left <= 4 ? 'warn' : 'muted'}
            label={
              breached
                ? t('complaint.slaBreached', { count: Math.abs(left) })
                : t('complaint.slaLeft', { count: left })
            }
          />
        )}
      </div>
      <p className="ledger__meta">
        <span className="identifier">{complaint.id}</span> ·{' '}
        {formatDateTime(complaint.raisedOn, lang)}
        {complaint.updates.length > 0 &&
          ` · ${t('complaint.updates', { count: complaint.updates.length })}`}
      </p>
      {complaint.updates.length > 0 && (
        <p className="ledger__note">
          {complaint.updates[complaint.updates.length - 1].by[lang]} —{' '}
          {complaint.updates[complaint.updates.length - 1].note}
        </p>
      )}
      {/* Screen readers get the raw figure, not just a coloured pill. */}
      <span className="visually-hidden">
        {formatQuantity(Math.abs(left), lang)} {t('complaint.hours')}
      </span>
    </li>
  )
}
