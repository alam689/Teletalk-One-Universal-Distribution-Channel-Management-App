import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field } from '../../components/ui'
import { DataRow, StatusPill } from '../../components/data'
import { formatDate, formatDateTime, formatIdentifier, formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { outbox } from '../../lib/outbox'
import { useOutboxEntry } from '../outbox/useOutbox'
import { useSession } from '../auth/AuthProvider'
import { queueLiftingAction } from './liftingApi'
import {
  CHAIN_LENGTH,
  canReject,
  canReturn,
  forwardTransition,
  stageIndex,
  stageTone,
} from './liftingStates'
import type { DepositSlip, LiftingAction, LiftingRequest } from './liftingTypes'
import './lifting.css'

/**
 * One lifting request, its history, and the single action this desk owns.
 *
 * The history is the point. Today this chain runs on an email thread, and the
 * question that thread exists to answer — *who has it, and what did the last
 * person do* — is the one thing an email thread is worst at. Every entry here
 * names an actor and a time.
 */

interface DetailProps {
  request: LiftingRequest
  /** True when this session owns the request's current stage. */
  actionable: boolean
  onSettled: () => void
}

export function RequestDetail({ request, actionable, onSettled }: DetailProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const position = stageIndex(request.stage)

  return (
    <div className="lift">
      <header className="lift__head">
        <div>
          <p className="lift__id identifier">{request.id}</p>
          <p className="lift__dealer">{request.dealerName[lang]}</p>
        </div>
        <StatusPill tone={stageTone(request.stage)} label={t(`stage.${request.stage}`)} />
      </header>

      {position >= 0 && (
        <p className="lift__progress">
          {t('lift.stageOf', { current: position + 1, total: CHAIN_LENGTH })}
          {' · '}
          {t('lift.waitingOn', { role: t(`stageOwner.${request.stage}`) })}
        </p>
      )}

      <dl className="datalist">
        <DataRow label={t('profile.zone')} value={`${request.zone[lang]} · ${request.territory[lang]}`} />
        <DataRow label={t('lift.raisedOn')} value={formatDate(request.raisedOn, lang)} />
        <DataRow label={t('lift.value')} value={formatMoney(request.value, lang)} />
        {request.invoiceNumber && (
          <DataRow label={t('lift.invoiceNumber')} value={request.invoiceNumber} id />
        )}
        {request.challanNumber && (
          <DataRow label={t('lift.challanNumber')} value={request.challanNumber} id />
        )}
      </dl>

      <p className="wiz__legend">{t('lift.lines')}</p>
      <ul className="lift__lines">
        {request.lines.map((line) => (
          <li className="lift__line" key={line.productCode}>
            <span>{line.productName[lang]}</span>
            <span className="lift__qty">
              {line.approved !== undefined && line.approved !== line.requested ? (
                <>
                  {/* Showing the cut, not just the result: the dealer is owed
                      the difference between what they asked for and what they
                      are getting, in one glance. */}
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

      {request.deposit && <DepositPanel deposit={request.deposit} lang={lang} />}

      <p className="wiz__legend">{t('lift.history')}</p>
      <ol className="timeline">
        {request.history.map((event, index) => (
          <li className="timeline__item" key={`${event.at}-${index}`}>
            <span className="timeline__dot" aria-hidden="true" />
            <p className="timeline__action">{t(`action.${event.action}`)}</p>
            <p className="timeline__actor">
              {event.actorName[lang]} · {t(`role.${event.actorRole}`)}{' '}
              <span className="identifier">{event.actorPosCode}</span>
            </p>
            <p className="timeline__at">{formatDateTime(event.at, lang)}</p>
            {event.note && <p className="timeline__note">{event.note}</p>}
          </li>
        ))}
      </ol>

      {actionable && <ActionPanel request={request} onSettled={onSettled} />}
    </div>
  )
}

function DepositPanel({ deposit, lang }: { deposit: DepositSlip; lang: Lang }) {
  const { t } = useTranslation()
  return (
    <>
      <p className="wiz__legend">{t('lift.deposit')}</p>
      <dl className="datalist">
        <DataRow label={t('lift.bank')} value={`${deposit.bankName} · ${deposit.branch}`} />
        <DataRow label={t('lift.slipNumber')} value={deposit.slipNumber} id />
        <DataRow label={t('lift.depositedOn')} value={formatDate(deposit.depositedOn, lang)} />
        <DataRow label={t('flow.amount')} value={formatMoney(deposit.amount, lang)} />
      </dl>
    </>
  )
}

/* ------------------------------ the action ------------------------------ */

interface FormState {
  note: string
  approved: Record<string, string>
  bankName: string
  branch: string
  slipNumber: string
  depositedOn: string
  amount: string
  invoiceNumber: string
  challanNumber: string
}

function ActionPanel({ request, onSettled }: { request: LiftingRequest; onSettled: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const forward = forwardTransition(request.stage)

  const [form, setForm] = useState<FormState>(() => ({
    note: '',
    approved: Object.fromEntries(
      request.lines.map((l) => [l.productCode, String(l.approved ?? l.requested)]),
    ),
    bankName: '',
    branch: '',
    slipNumber: '',
    depositedOn: '',
    amount: String(request.value),
    invoiceNumber: '',
    challanNumber: '',
  }))
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  const entry = useOutboxEntry(outboxId)
  const set = (patch: Partial<FormState>) => {
    setError(null)
    setForm((f) => ({ ...f, ...patch }))
  }

  // The queue is what actually moves the request, so the list can only be
  // refreshed once the server has confirmed it — not when the button is
  // pressed. Until then the panel says "queued", like everywhere else.
  useEffect(() => {
    if (entry?.status === 'settled') onSettled()
  }, [entry?.status, onSettled])

  const submit = (action: LiftingAction) => {
    const problem = validate(action, form, request)
    if (problem) {
      setError(problem)
      return
    }
    const queued = queueLiftingAction(
      {
        requestId: request.id,
        action,
        note: form.note.trim() || undefined,
        approvedQuantities:
          action === 'approve'
            ? Object.fromEntries(
                Object.entries(form.approved).map(([code, value]) => [
                  code,
                  Number(formatIdentifier(value)) || 0,
                ]),
              )
            : undefined,
        deposit:
          action === 'attachDeposit'
            ? {
                bankName: form.bankName.trim(),
                branch: form.branch.trim(),
                slipNumber: formatIdentifier(form.slipNumber),
                depositedOn: form.depositedOn,
                amount: Number(formatIdentifier(form.amount)),
              }
            : undefined,
        invoiceNumber: action === 'invoice' ? form.invoiceNumber.trim() : undefined,
        challanNumber: action === 'dispatch' ? form.challanNumber.trim() : undefined,
      },
      session,
    )
    setOutboxId(queued.id)
  }

  if (entry && entry.status !== 'failed') {
    return (
      <div className="form">
        <Alert tone={entry.status === 'settled' ? 'ok' : 'warn'}>
          {t(entry.status === 'settled' ? 'lift.actionDone' : 'lift.actionQueued')}
        </Alert>
      </div>
    )
  }

  return (
    <div className="form">
      <p className="wiz__legend">{t('lift.yourAction')}</p>

      {entry?.status === 'failed' && (
        <>
          <Alert tone="danger">{t(entry.errorKey ?? 'error.generic')}</Alert>
          <Button variant="ghost" onClick={() => outbox.retry(entry.id)}>
            {t('flow.retry')}
          </Button>
        </>
      )}

      {forward?.action === 'approve' && (
        <>
          <p className="wiz__note">{t('lift.approveHelp')}</p>
          {request.lines.map((line) => (
            <Field
              key={line.productCode}
              id={`approved-${line.productCode}`}
              label={line.productName[lang]}
              help={t('lift.requestedWas', { count: line.requested })}
              identifier
              inputMode="numeric"
              maxLength={6}
              value={form.approved[line.productCode] ?? ''}
              onChange={(e) =>
                set({
                  approved: {
                    ...form.approved,
                    [line.productCode]: formatIdentifier(e.target.value),
                  },
                })
              }
            />
          ))}
        </>
      )}

      {forward?.action === 'attachDeposit' && (
        <>
          <p className="wiz__note">{t('lift.depositHelp')}</p>
          <div className="wiz__grid">
            <Field
              id="bankName"
              label={t('lift.bankName')}
              value={form.bankName}
              onChange={(e) => set({ bankName: e.target.value })}
            />
            <Field
              id="branch"
              label={t('lift.branch')}
              value={form.branch}
              onChange={(e) => set({ branch: e.target.value })}
            />
            <Field
              id="slipNumber"
              label={t('lift.slipNumber')}
              identifier
              inputMode="numeric"
              value={form.slipNumber}
              onChange={(e) => set({ slipNumber: formatIdentifier(e.target.value) })}
            />
            <Field
              id="depositedOn"
              label={t('lift.depositedOn')}
              type="date"
              value={form.depositedOn}
              onChange={(e) => set({ depositedOn: e.target.value })}
            />
            <Field
              id="amount"
              label={t('flow.amount')}
              help={t('lift.amountHelp', { value: formatMoney(request.value, lang) })}
              identifier
              inputMode="numeric"
              value={form.amount}
              onChange={(e) => set({ amount: formatIdentifier(e.target.value) })}
            />
          </div>
        </>
      )}

      {forward?.action === 'invoice' && (
        <>
          {/* Recording an ERP number, not generating one — see the open
              question in STATUS.md. If Teletalk One is to generate it, this
              field becomes a server-side sequence. */}
          <p className="wiz__note">{t('lift.invoiceHelp')}</p>
          <Field
            id="invoiceNumber"
            label={t('lift.invoiceNumber')}
            placeholder="ERP-INV-2026-…"
            value={form.invoiceNumber}
            onChange={(e) => set({ invoiceNumber: e.target.value })}
          />
        </>
      )}

      {forward?.action === 'dispatch' && (
        <Field
          id="challanNumber"
          label={t('lift.challanNumber')}
          placeholder="CHL-2026-…"
          value={form.challanNumber}
          onChange={(e) => set({ challanNumber: e.target.value })}
        />
      )}

      <Field
        id="note"
        label={t('lift.note')}
        help={t('lift.noteHelp')}
        value={form.note}
        onChange={(e) => set({ note: e.target.value })}
      />

      {error && <Alert tone="danger">{t(error)}</Alert>}

      <div className="form__actions">
        {forward && (
          <Button onClick={() => submit(forward.action)}>{t(`action.${forward.action}`)}</Button>
        )}
        {canReturn(request.stage) && (
          <Button variant="ghost" onClick={() => submit('return')}>
            {t('action.return')}
          </Button>
        )}
        {canReject(request.stage) && (
          <Button variant="link" onClick={() => submit('reject')}>
            {t('action.reject')}
          </Button>
        )}
      </div>
    </div>
  )
}

/** Returns an `error.*` key, or null. */
function validate(
  action: LiftingAction,
  form: FormState,
  request: LiftingRequest,
): string | null {
  // Sending it back without saying why is the email process all over again.
  if ((action === 'return' || action === 'reject') && !form.note.trim()) {
    return 'error.reasonRequired'
  }
  if (action === 'approve') {
    const total = request.lines.reduce(
      (sum, line) => sum + (Number(formatIdentifier(form.approved[line.productCode] ?? '')) || 0),
      0,
    )
    if (total <= 0) return 'error.approvedZero'
    for (const line of request.lines) {
      const value = Number(formatIdentifier(form.approved[line.productCode] ?? '')) || 0
      if (value > line.requested) return 'error.approvedAboveRequested'
    }
  }
  if (action === 'attachDeposit') {
    if (!form.bankName.trim() || !form.branch.trim()) return 'error.bankRequired'
    if (formatIdentifier(form.slipNumber).length < 4) return 'error.slipRequired'
    if (!form.depositedOn) return 'error.depositDateRequired'
    const amount = Number(formatIdentifier(form.amount)) || 0
    if (amount <= 0) return 'error.amountRequired'
    // The deposit is what the invoice will be raised against; a mismatch here
    // becomes an F&A reconciliation three desks later.
    if (Math.abs(amount - request.value) > 0.5) return 'error.depositMismatch'
  }
  if (action === 'invoice' && form.invoiceNumber.trim().length < 4) {
    return 'error.invoiceRequired'
  }
  if (action === 'dispatch' && form.challanNumber.trim().length < 4) {
    return 'error.challanRequired'
  }
  return null
}
