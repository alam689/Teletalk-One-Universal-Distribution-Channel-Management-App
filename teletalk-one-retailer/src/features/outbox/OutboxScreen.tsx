import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Banner,
  Button,
  Card,
  DataRow,
  EmptyState,
  Pill,
  Screen,
  SectionHead,
  Text,
} from '../../components/ui'
import { useTheme } from '../../theme/ThemeProvider'
import { formatDateTime, formatQuantity, type Lang } from '../../i18n/format'
import { outbox, type OutboxEntry, type OutboxStatus } from '../../lib/outbox'
import { useIsOnline } from '../../lib/net'
import { useOutbox } from './OutboxBanner'

/**
 * The queue, made visible.
 *
 * The portal shows this as a banner and a page; here it is a tab, because on a
 * handset the queue is not an edge case — it is the normal state of a shop with
 * one bar of signal, and "has my transaction gone through" is a question the
 * retailer will ask several times a day.
 *
 * Two rules this screen exists to keep honest:
 *
 *  - Nothing pending is described as done. The wording is "waiting", the icon
 *    is a cloud, and the tone is not the success tone.
 *  - A failed entry shows the remedy the server named and offers exactly one
 *    button. Retrying is the retailer's decision, not a loop we run for them.
 */

const TONE: Record<OutboxStatus, 'ok' | 'warn' | 'danger' | 'brand'> = {
  settled: 'ok',
  pending: 'warn',
  inflight: 'brand',
  failed: 'danger',
}

export function OutboxScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const entries = useOutbox()
  const online = useIsOnline()

  const unsettled = entries.filter((e) => e.status === 'pending' || e.status === 'inflight')
  const failed = entries.filter((e) => e.status === 'failed')
  const settled = entries.filter((e) => e.status === 'settled')

  if (entries.length === 0) {
    return (
      <Screen>
        <EmptyState icon="check" title={t('outbox.emptyTitle')} body={t('outbox.emptyBody')} />
      </Screen>
    )
  }

  const Row = ({ entry }: { entry: OutboxEntry }) => (
    <Card key={entry.id}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}>
        <Text variant="small" weight="600" style={{ flex: 1 }}>
          {t(`flow.kind.${entry.kind}`, { defaultValue: entry.kind })}
        </Text>
        <Pill tone={TONE[entry.status]} label={t(`outbox.status.${entry.status}`)} />
      </View>
      <DataRow label={t('outbox.queuedAt')} value={formatDateTime(new Date(entry.queuedAt), lang)} />
      <DataRow label={t('outbox.reference')} value={entry.id} identifier />
      {entry.attempts > 0 ? (
        <DataRow label={t('outbox.attempts')} value={formatQuantity(entry.attempts, lang)} />
      ) : null}
      {entry.errorKey ? <Banner tone="danger" icon="alert" text={t(entry.errorKey)} /> : null}
      {entry.status === 'failed' ? (
        <View style={{ flexDirection: 'row', gap: space.s2 }}>
          <Button
            label={t('flow.retry')}
            icon="refresh"
            onPress={() => outbox.retry(entry.id)}
            block={false}
          />
          <Button
            label={t('outbox.discard')}
            variant="danger"
            onPress={() => outbox.remove(entry.id)}
            block={false}
          />
        </View>
      ) : null}
      {entry.status === 'settled' ? (
        <Button
          label={t('outbox.clearReceipt')}
          variant="ghost"
          onPress={() => outbox.remove(entry.id)}
        />
      ) : null}
    </Card>
  )

  return (
    <Screen>
      {!online ? <Banner tone="warn" icon="cloud" text={t('app.offline')} /> : null}

      {unsettled.length > 0 ? (
        <>
          <SectionHead title={t('outbox.waiting')} />
          <Text variant="small" tone="muted">
            {t('flow.queuedBody')}
          </Text>
          <View style={{ gap: space.s2 }}>
            {unsettled.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </View>
        </>
      ) : null}

      {failed.length > 0 ? (
        <>
          <SectionHead title={t('flow.failedTitle')} />
          <View style={{ gap: space.s2 }}>
            {failed.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </View>
        </>
      ) : null}

      {settled.length > 0 ? (
        <>
          <SectionHead title={t('outbox.confirmed')} />
          <View style={{ gap: space.s2 }}>
            {settled.map((entry) => (
              <Row key={entry.id} entry={entry} />
            ))}
          </View>
        </>
      ) : null}
    </Screen>
  )
}
