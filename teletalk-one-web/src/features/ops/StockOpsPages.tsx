import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Select } from '../../components/ui'
import { Panel, ResourceView, StatusPill } from '../../components/data'
import { formatIdentifier, formatQuantity, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { getLiftingProducts } from '../lifting/liftingApi'
import type { LiftingProduct } from '../lifting/liftingMock'
import { getReconcileLines, queueMovement, queueReconcile } from './opsApi'
import type { MovementKind, ReconcileResult } from './opsTypes'
import './ops.css'

const RETURN_REASONS = ['damaged', 'expired', 'wrongProduct', 'slowMoving'] as const

/* ---------------------------- return / transfer -------------------------- */

/**
 * Sending stock back, or sideways.
 *
 * One component and a `kind`, because the difference is two fields: a return
 * needs a reason and a transfer needs a destination. The rest — pick products,
 * enter quantities, queue it — is identical, and writing it twice is how the
 * two screens drift apart.
 */
export function StockMovementPage({ kind }: { kind: MovementKind }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()

  const capability = kind === 'return' ? 'stock.return' : 'stock.transfer'
  const titleKey = kind === 'return' ? 'item.stockReturn' : 'item.stockTransfer'

  const [products, setProducts] = useState<LiftingProduct[]>([])
  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [reasonCode, setReason] = useState('')
  const [toPosCode, setTo] = useState('')
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

  if (!can(capability)) return <LockedService titleKey={titleKey} capability={capability} />

  const total = products.reduce(
    (sum, p) => sum + (Number(formatIdentifier(quantities[p.code] ?? '')) || 0),
    0,
  )

  const reset = () => {
    setOutboxId(null)
    setQuantities({})
    setReason('')
    setTo('')
    setNote('')
  }

  const submit = () => {
    if (total === 0) return setError('error.movementEmpty')
    if (kind === 'return' && !reasonCode) return setError('error.reasonRequired')
    if (kind === 'transfer' && toPosCode.length !== 8) return setError('error.posLength')
    setError(null)
    const queued = queueMovement({
      kind,
      lines: products
        .map((p) => ({
          productCode: p.code,
          quantity: Number(formatIdentifier(quantities[p.code] ?? '')) || 0,
        }))
        .filter((l) => l.quantity > 0),
      reasonCode: kind === 'return' ? reasonCode : undefined,
      toPosCode: kind === 'transfer' ? toPosCode : undefined,
      note: note.trim() || undefined,
    })
    setOutboxId(queued.id)
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t(titleKey)}</h1>
        <p className="screen__lede">
          {t(kind === 'return' ? 'move.ledeReturn' : 'move.ledeTransfer')}
        </p>
      </header>

      <Panel>
        {outboxId ? (
          <OutcomePanel outboxId={outboxId} doneKey="move.done" onAgain={reset} />
        ) : (
          <div className="form">
            {kind === 'return' ? (
              <Select
                id="reasonCode"
                label={t('flow.reason')}
                placeholder={t('flow.chooseReason')}
                value={reasonCode}
                onChange={(e) => {
                  setError(null)
                  setReason(e.target.value)
                }}
                options={RETURN_REASONS.map((r) => ({
                  value: r,
                  label: t(`move.reason.${r}`),
                }))}
              />
            ) : (
              <Field
                id="toPosCode"
                label={t('move.to')}
                help={t('move.toHelp')}
                identifier
                inputMode="numeric"
                maxLength={8}
                value={toPosCode}
                onChange={(e) => {
                  setError(null)
                  setTo(formatIdentifier(e.target.value))
                }}
              />
            )}

            <div className="wiz__grid">
              {products.map((p) => (
                <Field
                  key={p.code}
                  id={`move-${p.code}`}
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
              id="moveNote"
              label={t('lift.note')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />

            <p className="wiz__note">{t('req.totalUnits', { count: total })}</p>
            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={submit}>
                {t(kind === 'return' ? 'move.sendReturn' : 'move.sendTransfer')}
              </Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------- reconcile ------------------------------- */

function isReconcileResult(value: unknown): value is ReconcileResult {
  return typeof value === 'object' && value !== null && 'variance' in value
}

/**
 * A physical count against what the system believes.
 *
 * **The system figure is hidden until a count is entered.** Showing it first
 * turns a stock count into a transcription exercise: the retailer reads the
 * screen, types the same number back, and the variance is always zero. The
 * whole value of the exercise is the number that does not match.
 */
export function StockReconcilePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const lines = useResource('stock.reconcile', getReconcileLines)

  const [counts, setCounts] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  if (!can('stock.reconcile')) {
    return <LockedService titleKey="item.stockReconcile" capability="stock.reconcile" />
  }

  const reset = () => {
    setOutboxId(null)
    setCounts({})
    setNote('')
  }

  const submit = () => {
    const entries = Object.entries(counts).filter(([, v]) => v !== '')
    if (entries.length === 0) return setError('error.countEmpty')
    setError(null)
    const queued = queueReconcile({
      counts: Object.fromEntries(
        entries.map(([code, value]) => [code, Number(formatIdentifier(value)) || 0]),
      ),
      note: note.trim() || undefined,
    })
    setOutboxId(queued.id)
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.stockReconcile')}</h1>
        <p className="screen__lede">{t('count.lede')}</p>
      </header>

      <Panel>
        {outboxId ? (
          <OutcomePanel outboxId={outboxId} doneKey="count.done" onAgain={reset}>
            {(result) =>
              isReconcileResult(result) ? (
                <ul className="ledger">
                  {Object.entries(result.variance).map(([code, delta]) => (
                    <li className="ledger__item" key={code}>
                      <div className="ledger__body">
                        <p className="ledger__title">
                          {lines.data?.find((l) => l.productCode === code)?.productName[lang] ??
                            code}
                        </p>
                      </div>
                      <div className="ledger__right">
                        <StatusPill
                          tone={delta === 0 ? 'ok' : 'danger'}
                          label={
                            delta === 0
                              ? t('count.matched')
                              : `${delta > 0 ? '+' : '−'}${formatQuantity(Math.abs(delta), lang)}`
                          }
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : null
            }
          </OutcomePanel>
        ) : (
          <ResourceView resource={lines} skeletonRows={5}>
            {(data) => (
              <div className="form">
                <p className="wiz__note">{t('count.help')}</p>
                <div className="wiz__grid">
                  {data.map((line) => (
                    <Field
                      key={line.productCode}
                      id={`count-${line.productCode}`}
                      label={line.productName[lang]}
                      identifier
                      inputMode="numeric"
                      maxLength={5}
                      value={counts[line.productCode] ?? ''}
                      onChange={(e) => {
                        setError(null)
                        setCounts({
                          ...counts,
                          [line.productCode]: formatIdentifier(e.target.value),
                        })
                      }}
                    />
                  ))}
                </div>
                <Field
                  id="countNote"
                  label={t('lift.note')}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {error && <Alert tone="danger">{t(error)}</Alert>}
                <div className="form__actions">
                  <Button onClick={submit}>{t('count.submit')}</Button>
                </div>
              </div>
            )}
          </ResourceView>
        )}
      </Panel>
    </div>
  )
}
