import { useTranslation } from 'react-i18next'
import { useUnsettledCount } from './useOutbox'
import './outbox.css'

/**
 * Standing notice that the counter owes the server something.
 *
 * It exists because signing out discards the queue (see `AuthProvider`): a
 * retailer must not be able to walk away from an unsent activation without
 * having been told it is unsent. `role="status"` and not `alert` — it is a
 * persistent condition, not an event.
 */
export function OutboxBanner() {
  const { t } = useTranslation()
  const count = useUnsettledCount()

  if (count === 0) return null

  return (
    <div className="outbox-banner" role="status" aria-live="polite">
      {t('outbox.pendingCount', { count })}
    </div>
  )
}
