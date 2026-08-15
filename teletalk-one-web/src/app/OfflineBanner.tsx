import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * Field connectivity is the deck's first listed challenge. A retailer needs to
 * know the counter is offline BEFORE they start an activation, not after the
 * request fails halfway through.
 */
export function OfflineBanner() {
  const { t } = useTranslation()
  const [offline, setOffline] = useState(() =>
    typeof navigator === 'undefined' ? false : !navigator.onLine,
  )

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  if (!offline) return null

  return (
    <div className="offline" role="status" aria-live="assertive">
      {t('app.offline')}
    </div>
  )
}
