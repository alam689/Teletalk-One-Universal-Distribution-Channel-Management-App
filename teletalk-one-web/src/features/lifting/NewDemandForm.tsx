import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field } from '../../components/ui'
import { formatIdentifier, formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { useOutboxEntry } from '../outbox/useOutbox'
import { useSession } from '../auth/AuthProvider'
import { getLiftingProducts, queueNewRequest } from './liftingApi'
import type { LiftingProduct } from './liftingMock'
import './lifting.css'

/**
 * Raising demand.
 *
 * Quantities are entered in **packs**, not units, because that is how the
 * warehouse ships and how the dealer counts — a demand for 37 SIMs is not a
 * thing anyone can fulfil. The unit total is shown alongside so the number the
 * dealer will be invoiced for is never a surprise.
 */
export function NewDemandForm({
  onSettled,
  onCancel,
}: {
  onSettled: () => void
  onCancel: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()

  const [products, setProducts] = useState<LiftingProduct[]>([])
  const [packs, setPacks] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)
  const entry = useOutboxEntry(outboxId)

  useEffect(() => {
    const controller = new AbortController()
    getLiftingProducts(controller.signal)
      .then(setProducts)
      .catch((err: unknown) => logger.warn('lifting products unavailable', { err }))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (entry?.status === 'settled') onSettled()
  }, [entry?.status, onSettled])

  const unitsFor = (product: LiftingProduct) =>
    (Number(formatIdentifier(packs[product.code] ?? '')) || 0) * product.packSize

  const total = products.reduce((sum, p) => sum + unitsFor(p) * p.unitPrice, 0)
  const units = products.reduce((sum, p) => sum + unitsFor(p), 0)

  const submit = () => {
    if (units === 0) {
      setError('error.demandEmpty')
      return
    }
    setError(null)
    const quantities = Object.fromEntries(
      products.map((p) => [p.code, unitsFor(p)]).filter(([, quantity]) => Number(quantity) > 0),
    )
    const queued = queueNewRequest({ quantities, note: note.trim() || undefined }, session)
    setOutboxId(queued.id)
  }

  if (entry && entry.status !== 'failed') {
    return (
      <Alert tone={entry.status === 'settled' ? 'ok' : 'warn'}>
        {t(entry.status === 'settled' ? 'lift.demandRaised' : 'lift.actionQueued')}
      </Alert>
    )
  }

  return (
    <div className="form">
      <p className="wiz__legend">{t('lift.newDemand')}</p>
      <p className="wiz__note">{t('lift.newDemandHelp')}</p>

      {entry?.status === 'failed' && <Alert tone="danger">{t(entry.errorKey ?? 'error.generic')}</Alert>}

      <div className="wiz__grid">
        {products.map((product) => (
          <Field
            key={product.code}
            id={`packs-${product.code}`}
            label={product.name[lang]}
            help={t('lift.packHelp', {
              size: product.packSize,
              price: formatMoney(product.unitPrice, lang),
            })}
            identifier
            inputMode="numeric"
            maxLength={4}
            value={packs[product.code] ?? ''}
            onChange={(e) =>
              setPacks({ ...packs, [product.code]: formatIdentifier(e.target.value) })
            }
          />
        ))}
      </div>

      <Field
        id="demandNote"
        label={t('lift.note')}
        help={t('lift.noteHelp')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <dl className="datalist">
        <div className="datarow">
          <dt>{t('lift.totalUnits')}</dt>
          <dd>{formatQuantity(units, lang)}</dd>
        </div>
        <div className="datarow">
          <dt>{t('lift.value')}</dt>
          <dd>{formatMoney(total, lang)}</dd>
        </div>
      </dl>

      {error && <Alert tone="danger">{t(error)}</Alert>}

      <div className="form__actions">
        <Button onClick={submit}>{t('lift.raise')}</Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('wizard.cancel')}
        </Button>
      </div>
    </div>
  )
}
