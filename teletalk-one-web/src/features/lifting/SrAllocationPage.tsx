import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Select } from '../../components/ui'
import { Panel, ResourceView } from '../../components/data'
import { formatIdentifier, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { useOutboxEntry } from '../outbox/useOutbox'
import { getLiftingProducts, getSrRoute, queueSrAllocation } from './liftingApi'
import type { LiftingProduct } from './liftingMock'
import './lifting.css'

/**
 * Allocating stock from the dealer's shelf to a sales representative.
 *
 * It goes through the outbox like every other movement of stock or money: a
 * dealer allocating at 7am in a warehouse with one bar of signal must not have
 * to know whether it went through, and must not be able to send it twice by
 * pressing again.
 */
export default function SrAllocationPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()

  const route = useResource('sr.route', getSrRoute)
  const [products, setProducts] = useState<LiftingProduct[]>([])
  const [srPosCode, setSrPosCode] = useState('')
  const [quantities, setQuantities] = useState<Record<string, string>>({})
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

  if (!can('sr.allocate')) {
    return <LockedService titleKey="item.srAllocation" capability="sr.allocate" />
  }

  const total = products.reduce(
    (sum, p) => sum + (Number(formatIdentifier(quantities[p.code] ?? '')) || 0),
    0,
  )

  const submit = () => {
    if (!srPosCode) {
      setError('error.srRequired')
      return
    }
    if (total === 0) {
      setError('error.allocationEmpty')
      return
    }
    setError(null)
    const queued = queueSrAllocation({
      srPosCode,
      quantities: Object.fromEntries(
        products
          .map((p) => [p.code, Number(formatIdentifier(quantities[p.code] ?? '')) || 0] as const)
          .filter(([, quantity]) => quantity > 0),
      ),
    })
    setOutboxId(queued.id)
  }

  const reset = () => {
    setOutboxId(null)
    setQuantities({})
    setSrPosCode('')
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.srAllocation')}</h1>
        <p className="screen__lede">{t('sr.allocateLede')}</p>
      </header>

      <Panel>
        {entry && entry.status !== 'failed' ? (
          <div className="form">
            <Alert tone={entry.status === 'settled' ? 'ok' : 'warn'}>
              {t(entry.status === 'settled' ? 'sr.allocated' : 'lift.actionQueued')}
            </Alert>
            {entry.status === 'settled' && (
              <div className="form__actions">
                <Button onClick={reset}>{t('sr.allocateAnother')}</Button>
              </div>
            )}
          </div>
        ) : (
          <div className="form">
            {entry?.status === 'failed' && (
              <Alert tone="danger">{t(entry.errorKey ?? 'error.generic')}</Alert>
            )}

            <ResourceView resource={route} skeletonRows={1}>
              {(data) => (
                <Select
                  id="srPosCode"
                  label={t('sr.representative')}
                  placeholder={t('sr.chooseRepresentative')}
                  value={srPosCode}
                  onChange={(e) => {
                    setError(null)
                    setSrPosCode(e.target.value)
                  }}
                  options={[
                    { value: data.srPosCode, label: `${data.srName[lang]} · ${data.srPosCode}` },
                  ]}
                />
              )}
            </ResourceView>

            <div className="wiz__grid">
              {products.map((product) => (
                <Field
                  key={product.code}
                  id={`alloc-${product.code}`}
                  label={product.name[lang]}
                  identifier
                  inputMode="numeric"
                  maxLength={5}
                  value={quantities[product.code] ?? ''}
                  onChange={(e) => {
                    setError(null)
                    setQuantities({
                      ...quantities,
                      [product.code]: formatIdentifier(e.target.value),
                    })
                  }}
                />
              ))}
            </div>

            <p className="wiz__note">
              {t('sr.totalUnits', { count: total })}
            </p>

            {error && <Alert tone="danger">{t(error)}</Alert>}

            <div className="form__actions">
              <Button onClick={submit}>{t('sr.allocate')}</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}
