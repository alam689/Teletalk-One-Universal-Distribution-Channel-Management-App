import { useSyncExternalStore } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Banner } from '../../components/ui'
import { useTheme } from '../../theme/ThemeProvider'
import { outbox } from '../../lib/outbox'
import { useIsOnline } from '../../lib/net'

/** Live view of the queue. One subscription, shared by every screen. */
export function useOutbox() {
  return useSyncExternalStore(outbox.subscribe, outbox.list, outbox.list)
}

export function useUnsettledCount(): number {
  return useOutbox().filter((e) => e.status === 'pending' || e.status === 'inflight').length
}

/**
 * Two facts the retailer needs before they do anything else: whether the phone
 * is reachable, and whether anything they have already done is still waiting to
 * reach the server.
 *
 * They are separate lines because they are separate problems. Being offline is
 * expected in a bazaar and needs no action; three transactions sitting
 * unconfirmed is a reason not to hand the customer their change yet.
 */
export function StatusBanners() {
  const { t } = useTranslation()
  const { space } = useTheme()
  const online = useIsOnline()
  const pending = useUnsettledCount()

  if (online && pending === 0) return null

  return (
    <View style={{ gap: space.s2 }}>
      {!online ? <Banner tone="warn" icon="cloud" text={t('app.offline')} /> : null}
      {pending > 0 ? (
        <Banner tone="brand" icon="cloud" text={t('outbox.pendingCount', { count: pending })} />
      ) : null}
    </View>
  )
}
