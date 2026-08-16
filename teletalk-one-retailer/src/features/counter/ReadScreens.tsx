import { useState } from 'react'
import { Linking, Pressable, RefreshControl, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Banner,
  Button,
  Card,
  DataRow,
  EmptyState,
  Field,
  ListRow,
  Metric,
  Pill,
  ResourceView,
  Screen,
  SectionHead,
  Text,
} from '../../components/ui'
import { useTheme } from '../../theme/ThemeProvider'
import {
  formatDate,
  formatMoney,
  formatQuantity,
  formatRelativeDay,
  maskMsisdn,
  type Lang,
} from '../../i18n/format'
import { useResource, type Resource } from '../../lib/useResource'
import { errorKey } from '../../lib/http'
import { useSession } from '../auth/AuthProvider'
import { useOutbox } from '../outbox/OutboxBanner'
import { applyFilter, mergeLedger, queuedAsLedger, type LedgerFilter } from './ledger'
import * as api from './counterApi'
import type { Period, StockType } from './counterTypes'

/**
 * The read surface: stock, ledger, commission, targets, campaigns, offers,
 * notifications, support and customer search.
 *
 * They share a shape, and the shape is the point — `useResource` for the four
 * states, `ResourceView` to make the broken one unavoidable, and pull-to-
 * refresh on every one of them, because each is reachable while the tower is
 * down and the retailer's first instinct will be to pull.
 */

/** Turns a `Resource` into what `ResourceView` reads, including emptiness. */
function view<T>(resource: Resource<T>, isEmpty?: (data: T) => boolean) {
  return {
    data: resource.data,
    loading: resource.loading,
    errorKey: resource.error,
    isEmpty: resource.data ? isEmpty?.(resource.data) : false,
  }
}

function refresher(resource: Resource<unknown>) {
  return <RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />
}

/* --------------------------------- stock --------------------------------- */

export function StockScreen({ route }: { route?: { params?: { id?: StockType } } }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const type: StockType = route?.params?.id === 'product' ? 'product' : 'sim'
  const stock = useResource(`stock-${type}`, (signal) => api.getStock(type, signal))

  return (
    <Screen refreshControl={refresher(stock)}>
      <Text variant="small" tone="muted">
        {t(type === 'sim' ? 'stock.lede' : 'stock.ledeProduct')}
      </Text>
      <ResourceView
        state={view(stock, (data) => data.batches.length === 0)}
        emptyIcon="boxes"
        emptyTitle={t('stock.emptyTitle')}
        emptyBody={t('stock.emptyBody')}
        onRetry={stock.reload}
      >
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              <Metric
                strong
                label={t(type === 'sim' ? 'stock.total' : 'stock.totalProduct')}
                value={formatQuantity(data.total, lang)}
                hint={t('stock.totalHint')}
              />
            </View>
            {data.total <= data.lowThreshold ? (
              <Banner
                tone="warn"
                icon="alert"
                text={t('stock.lowWarning', { count: data.lowThreshold })}
              />
            ) : null}
            <SectionHead title={t('stock.byBatch')} />
            <View style={{ gap: space.s2 }}>
              {data.batches.map((batch) => (
                <Card key={`${batch.productCode}-${batch.receivedOn}`}>
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                  >
                    <Text variant="small" weight="600" style={{ flex: 1 }}>
                      {batch.productName[lang]}
                    </Text>
                    <Text variant="small" weight="700">
                      {formatQuantity(batch.count, lang)}
                    </Text>
                  </View>
                  <Text variant="caption" tone="muted">
                    {t('stock.received')} {formatDate(batch.receivedOn, lang)}
                  </Text>
                  {batch.firstSerial ? (
                    <Text variant="caption" tone="muted" identifier>
                      {batch.firstSerial} – {batch.lastSerial}
                    </Text>
                  ) : null}
                </Card>
              ))}
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  )
}

/* ------------------------------ transactions ------------------------------ */

export function TransactionsScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space, colors, radius } = useTheme()
  const [filter, setFilter] = useState<LedgerFilter>('all')
  const ledger = useResource('ledger', (signal) => api.getLedger(signal))
  const queued = useOutbox()

  // The queue is merged into the server's list rather than shown beside it. A
  // retailer asking "did that recharge go through" wants one list in time
  // order; two lists is a question about our architecture, not about theirs.
  const filtered = applyFilter(mergeLedger(ledger.data ?? [], queuedAsLedger(queued)), filter)

  const FILTERS: LedgerFilter[] = ['all', 'activation', 'recharge', 'attention']
  const labelFor: Record<LedgerFilter, string> = {
    all: t('ledger.filterAll'),
    activation: t('ledger.filterSim'),
    recharge: t('ledger.filterRecharge'),
    attention: t('ledger.filterAttention'),
  }
  const toneFor = { settled: 'ok', pending: 'warn', failed: 'danger', reversed: 'muted' } as const

  return (
    <Screen refreshControl={refresher(ledger)}>
      <Text variant="small" tone="muted">
        {t('ledger.lede')}
      </Text>

      <View
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}
        accessibilityRole="tablist"
      >
        {FILTERS.map((id) => (
          <Pressable
            key={id}
            onPress={() => setFilter(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === id }}
            style={{
              minHeight: 40,
              justifyContent: 'center',
              paddingHorizontal: space.s4,
              borderRadius: radius.pill,
              backgroundColor: filter === id ? colors.brand : colors.surface,
              borderWidth: 1,
              borderColor: filter === id ? colors.brand : colors.ruleControl,
            }}
          >
            <Text variant="small" weight="600" tone={filter === id ? 'onBrand' : 'ink'}>
              {labelFor[id]}
            </Text>
          </Pressable>
        ))}
      </View>

      {filtered.length === 0 ? (
        <EmptyState icon="list" title={t('ledger.emptyTitle')} body={t('ledger.emptyBody')} />
      ) : (
        <View style={{ gap: space.s2 }}>
          {filtered.map((row) => (
            <Card key={row.id}>
              <View
                style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
              >
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="small" weight="600">
                    {t(`ledger.kind.${row.kind}`)}
                  </Text>
                  {row.msisdn ? (
                    <Text variant="caption" tone="muted" identifier>
                      {maskMsisdn(row.msisdn)}
                    </Text>
                  ) : null}
                  <Text variant="caption" tone="muted">
                    {formatRelativeDay(row.at, lang, {
                      today: t('data.today'),
                      yesterday: t('data.yesterday'),
                    })}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: space.s1 }}>
                  {row.amount !== undefined ? (
                    <Text variant="small" weight="700">
                      {formatMoney(row.amount, lang)}
                    </Text>
                  ) : null}
                  <Pill
                    tone={toneFor[row.state]}
                    label={row.local ? t('ledger.stateQueued') : t(`ledger.state.${row.state}`)}
                  />
                </View>
              </View>
              {/* The CBS reference, unlocalised, because it is what gets read
                  down a phone line to the helpline. */}
              <Text variant="caption" tone="muted" identifier>
                {row.id}
              </Text>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  )
}

/* ------------------------------ sales report ------------------------------ */

const PERIODS: Period[] = ['today', 'week', 'month']

function PeriodPicker({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const { t } = useTranslation()
  const { space, colors, radius } = useTheme()
  return (
    <View style={{ flexDirection: 'row', gap: space.s2 }} accessibilityRole="tablist">
      {PERIODS.map((id) => (
        <Pressable
          key={id}
          onPress={() => onChange(id)}
          accessibilityRole="tab"
          accessibilityState={{ selected: value === id }}
          style={{
            flex: 1,
            minHeight: 40,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: radius.pill,
            backgroundColor: value === id ? colors.brand : colors.surface,
            borderWidth: 1,
            borderColor: value === id ? colors.brand : colors.ruleControl,
          }}
        >
          <Text variant="small" weight="600" tone={value === id ? 'onBrand' : 'ink'}>
            {t(`period.${id}`)}
          </Text>
        </Pressable>
      ))}
    </View>
  )
}

export function SalesReportScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const [period, setPeriod] = useState<Period>('today')
  const sales = useResource(`sales-${period}`, (signal) => api.getSales(period, signal))

  return (
    <Screen refreshControl={refresher(sales)}>
      <Text variant="small" tone="muted">
        {t('sales.lede')}
      </Text>
      <PeriodPicker value={period} onChange={setPeriod} />
      <ResourceView
        state={view(sales)}
        emptyIcon="chart"
        emptyTitle={t('ledger.emptyTitle')}
        onRetry={sales.reload}
      >
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              <Metric
                strong
                label={t('sales.activations')}
                value={formatQuantity(data.activations, lang)}
                hint={data.target ? t('sales.ofTarget', { target: data.target }) : undefined}
              />
              <Metric label={t('sales.recharges')} value={formatQuantity(data.recharges, lang)} />
              <Metric
                label={t('sales.rechargeAmount')}
                value={formatMoney(data.rechargeAmount, lang)}
              />
              <Metric label={t('commission.total')} value={formatMoney(data.commission, lang)} />
            </View>

            {/* Numbers, not a chart. A sparkline on a 360px screen that a
                retailer reads in sunlight communicates less than the figures
                do, and costs a charting library. */}
            <SectionHead title={t('sales.daily')} />
            <Card>
              {data.points.map((point) => (
                <DataRow
                  key={point.day}
                  label={formatDate(point.day, lang)}
                  value={`${formatQuantity(point.activations, lang)} · ${formatMoney(point.rechargeAmount, lang)}`}
                />
              ))}
            </Card>
          </>
        )}
      </ResourceView>
    </Screen>
  )
}

/* ------------------------------- commission ------------------------------- */

export function CommissionScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const [period, setPeriod] = useState<Period>('month')
  const commission = useResource(`commission-${period}`, (signal) =>
    api.getCommission(period, signal),
  )
  const statement = useResource('statement', (signal) => api.getCommissionStatement(signal))

  return (
    <Screen refreshControl={refresher(commission)}>
      <Text variant="small" tone="muted">
        {t('commission.lede')}
      </Text>
      <PeriodPicker value={period} onChange={setPeriod} />
      <ResourceView
        state={view(commission)}
        emptyIcon="coin"
        emptyTitle={t('statement.emptyTitle')}
        onRetry={commission.reload}
      >
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              <Metric strong label={t('commission.total')} value={formatMoney(data.total, lang)} />
              <Metric label={t('commission.paid')} value={formatMoney(data.paid, lang)} />
              <Metric
                label={t('commission.pending')}
                value={formatMoney(data.pending, lang)}
                hint={t('commission.pendingHint')}
              />
            </View>
            <SectionHead title={t('commission.breakdown')} />
            <Card>
              {data.lines.map((line) => (
                <DataRow
                  key={line.code}
                  label={`${line.label[lang]} · ${formatQuantity(line.count, lang)}`}
                  value={formatMoney(line.amount, lang)}
                />
              ))}
            </Card>
          </>
        )}
      </ResourceView>

      <SectionHead title={t('statement.byPeriod')} />
      <ResourceView
        state={view(statement, (data) => data.lines.length === 0)}
        emptyIcon="invoice"
        emptyTitle={t('statement.emptyTitle')}
        onRetry={statement.reload}
      >
        {(data) => (
          <View style={{ gap: space.s2 }}>
            {data.lines.map((line) => (
              <Card key={line.period}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                >
                  <Text variant="small" weight="600">
                    {line.label[lang]}
                  </Text>
                  <Pill
                    tone={line.status === 'paid' ? 'ok' : 'warn'}
                    label={t(`statement.status.${line.status}`)}
                  />
                </View>
                <DataRow label={t('statement.totalEarned')} value={formatMoney(line.earned, lang)} />
                <DataRow label={t('statement.totalPaid')} value={formatMoney(line.paid, lang)} />
                {/* The payment reference is the whole reason this screen
                    exists — it is what the retailer quotes when they ring to
                    ask where the money went. */}
                <DataRow
                  label={t('statement.paidOn', {
                    date: line.paidOn ? formatDate(line.paidOn, lang) : '—',
                  })}
                  value={line.reference ?? t('statement.noReference')}
                  identifier={!!line.reference}
                />
              </Card>
            ))}
          </View>
        )}
      </ResourceView>
    </Screen>
  )
}

/* ------------------------------- outstanding ------------------------------ */

export function OutstandingScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const due = useResource('outstanding', (signal) => api.getOutstanding(signal))

  return (
    <Screen refreshControl={refresher(due)}>
      <Text variant="small" tone="muted">
        {t('due.lede')}
      </Text>
      <ResourceView
        state={view(due, (data) => data.items.length === 0)}
        emptyIcon="check"
        emptyTitle={t('due.emptyTitle')}
        emptyBody={t('due.emptyBody')}
        onRetry={due.reload}
      >
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              <Metric strong label={t('due.total')} value={formatMoney(data.total, lang)} />
              <Metric label={t('due.overdue')} value={formatMoney(data.overdue, lang)} />
              {data.creditLimit !== undefined ? (
                <Metric
                  label={t('due.creditLimit')}
                  value={formatMoney(data.creditLimit, lang)}
                  hint={t('due.headroom', {
                    amount: formatMoney(Math.max(data.creditLimit - data.total, 0), lang),
                  })}
                />
              ) : null}
            </View>
            {data.creditLimit !== undefined && data.total > data.creditLimit * 0.8 ? (
              <Banner tone="warn" icon="alert" text={t('due.nearLimit')} />
            ) : null}
            <SectionHead title={t('due.items')} />
            <View style={{ gap: space.s2 }}>
              {data.items.map((item) => (
                <ListRow
                  key={item.id}
                  title={item.what[lang]}
                  subtitle={
                    item.overdueDays > 0
                      ? t('due.overdueBy', { count: item.overdueDays })
                      : t('due.dueOn', { date: formatDate(item.dueOn, lang) })
                  }
                  right={formatMoney(item.amount, lang)}
                  rightTone={item.overdueDays > 0 ? 'danger' : 'ink'}
                />
              ))}
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  )
}

/* --------------------------------- target --------------------------------- */

export function TargetScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space, colors, radius } = useTheme()
  const target = useResource('target', (signal) => api.getTarget(signal))

  return (
    <Screen refreshControl={refresher(target)}>
      <Text variant="small" tone="muted">
        {t('target.lede')}
      </Text>
      <ResourceView
        state={view(target, (data) => data.lines.length === 0)}
        emptyIcon="target"
        emptyTitle={t('ledger.emptyTitle')}
        onRetry={target.reload}
      >
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              <Metric
                strong
                label={t('target.daysLeft')}
                value={formatQuantity(data.daysLeft, lang)}
                hint={t('target.thisMonth')}
              />
              <Metric
                label={t('target.metCount')}
                value={formatQuantity(
                  data.lines.filter((line) => line.achieved >= line.target).length,
                  lang,
                )}
              />
            </View>
            <SectionHead title={t('target.byLine')} />
            <View style={{ gap: space.s2 }}>
              {data.lines.map((line) => {
                const pct = line.target === 0 ? 0 : Math.round((line.achieved / line.target) * 100)
                const show = (n: number) =>
                  line.unit === 'money' ? formatMoney(n, lang) : formatQuantity(n, lang)
                return (
                  <Card key={line.code}>
                    <View
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        gap: space.s3,
                      }}
                    >
                      <Text variant="small" weight="600" style={{ flex: 1 }}>
                        {line.label[lang]}
                      </Text>
                      <Text variant="small" weight="700">
                        {t('target.percent', { pct })}
                      </Text>
                    </View>
                    {/* A bar, and a number beside it. The bar alone would be
                        the only carrier of the information, which fails anyone
                        who cannot judge a length at a glance. */}
                    <View
                      style={{
                        height: 8,
                        borderRadius: radius.pill,
                        backgroundColor: colors.surface3,
                        overflow: 'hidden',
                      }}
                      accessibilityRole="progressbar"
                      accessibilityValue={{ min: 0, max: 100, now: pct }}
                    >
                      <View
                        style={{
                          width: `${Math.min(pct, 100)}%`,
                          height: '100%',
                          backgroundColor: pct >= 100 ? colors.ok : colors.brand,
                        }}
                      />
                    </View>
                    <Text variant="caption" tone="muted">
                      {show(line.achieved)} / {show(line.target)}
                    </Text>
                  </Card>
                )
              })}
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  )
}

/* ------------------------------- campaigns -------------------------------- */

export function CampaignsScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const campaigns = useResource('campaigns', (signal) => api.getCampaigns(signal))

  return (
    <Screen refreshControl={refresher(campaigns)}>
      <Text variant="small" tone="muted">
        {t('campaign.lede')}
      </Text>
      <ResourceView
        state={view(campaigns, (data) => data.length === 0)}
        emptyIcon="megaphone"
        emptyTitle={t('campaign.emptyTitle')}
        emptyBody={t('campaign.emptyBody')}
        onRetry={campaigns.reload}
      >
        {(data) => (
          <View style={{ gap: space.s2 }}>
            {data.map((campaign) => (
              <Card key={campaign.id}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                >
                  <Text variant="small" weight="600" style={{ flex: 1 }}>
                    {campaign.name[lang]}
                  </Text>
                  <Pill
                    tone={campaign.enrolled ? 'ok' : 'muted'}
                    label={t(campaign.enrolled ? 'campaign.enrolled' : 'campaign.open')}
                  />
                </View>
                <Text variant="small" tone="soft">
                  {campaign.body[lang]}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatDate(campaign.startsOn, lang)} – {formatDate(campaign.endsOn, lang)}
                </Text>
                {campaign.progress ? (
                  <DataRow
                    label={t('campaign.reward', {
                      amount: formatMoney(campaign.progress.rewardAmount, lang),
                    })}
                    value={`${formatQuantity(campaign.progress.achieved, lang)} / ${formatQuantity(
                      campaign.progress.target,
                      lang,
                    )}`}
                  />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ResourceView>
    </Screen>
  )
}

export function OffersScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const offers = useResource('offers', (signal) => api.getOffers(signal))

  return (
    <Screen refreshControl={refresher(offers)}>
      <Text variant="small" tone="muted">
        {t('offer.lede')}
      </Text>
      <ResourceView
        state={view(offers, (data) => data.length === 0)}
        emptyIcon="gift"
        emptyTitle={t('offer.emptyTitle')}
        onRetry={offers.reload}
      >
        {(data) => (
          <View style={{ gap: space.s2 }}>
            {data.map((offer) => (
              <Card key={offer.id}>
                <Text variant="small" weight="600">
                  {offer.name[lang]}
                </Text>
                <Text variant="small" tone="soft">
                  {offer.body[lang]}
                </Text>
                <View style={{ flexDirection: 'row', gap: space.s4, flexWrap: 'wrap' }}>
                  {offer.price !== undefined ? (
                    <Text variant="small" weight="700">
                      {formatMoney(offer.price, lang)}
                    </Text>
                  ) : null}
                  {offer.validity ? (
                    <Text variant="small" tone="muted">
                      {offer.validity[lang]}
                    </Text>
                  ) : null}
                </View>
                {/* The dial code is read aloud across a counter, so it stays
                    Latin and monospaced in both languages. */}
                {offer.code ? (
                  <DataRow label={t('offer.dial')} value={offer.code} identifier />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </ResourceView>
    </Screen>
  )
}

/* ----------------------------- notifications ------------------------------ */

export function NotificationsScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const feed = useResource('notifications', (signal) => api.getNotifications(signal))

  return (
    <Screen refreshControl={refresher(feed)}>
      <ResourceView
        state={view(feed, (data) => data.length === 0)}
        emptyIcon="bell"
        emptyTitle={t('notifications.emptyTitle')}
        emptyBody={t('notifications.emptyBody')}
        onRetry={feed.reload}
      >
        {(data) => (
          <View style={{ gap: space.s2 }}>
            {data.map((item) => (
              <Card key={item.id}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                >
                  <Text variant="small" weight={item.read ? '400' : '700'} style={{ flex: 1 }}>
                    {item.title[lang]}
                  </Text>
                  {item.severity !== 'info' ? (
                    <Pill
                      tone={item.severity === 'action' ? 'danger' : 'warn'}
                      label={t(`notifications.severity.${item.severity}`)}
                    />
                  ) : null}
                </View>
                <Text variant="small" tone="soft">
                  {item.body[lang]}
                </Text>
                <Text variant="caption" tone="muted">
                  {formatRelativeDay(item.at, lang, {
                    today: t('data.today'),
                    yesterday: t('data.yesterday'),
                  })}
                </Text>
              </Card>
            ))}
          </View>
        )}
      </ResourceView>
    </Screen>
  )
}

/* --------------------------------- support -------------------------------- */

export function SupportScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()

  return (
    <Screen>
      <Text variant="small" tone="muted">
        {t('support.lede')}
      </Text>

      <Card>
        <SectionHead title={t('support.call')} />
        {/* `tel:` and `mailto:` rather than a number to copy out. This is the
            one place the app can do something a browser on a counter PC
            cannot, and a retailer with a problem should not be typing. */}
        <Button
          label={`${t('support.helpline')} · 121`}
          icon="help"
          onPress={() => void Linking.openURL('tel:121')}
        />
        <Button
          label={t('support.channelDesk')}
          icon="person"
          variant="secondary"
          onPress={() => void Linking.openURL('tel:+8801550000121')}
        />
        <Button
          label={t('support.email')}
          icon="ticket"
          variant="secondary"
          onPress={() => void Linking.openURL('mailto:channel.support@teletalk.com.bd')}
        />
      </Card>

      <Card>
        <SectionHead title={t('support.quote')} />
        <Text variant="caption" tone="muted">
          {t('support.quoteHelp')}
        </Text>
        <DataRow label={t('profile.posCode')} value={session.posCode} identifier />
        <DataRow label={t('profile.outlet')} value={session.name[lang]} />
        <DataRow label={t('profile.msisdn')} value={session.msisdn} identifier />
      </Card>
    </Screen>
  )
}

/* ----------------------------- customer search ---------------------------- */

export function CustomerSearchScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<Awaited<ReturnType<typeof api.searchCustomers>> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const search = async () => {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.searchCustomers(query))
    } catch (err) {
      setError(errorKey(err))
      setResult(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Text variant="small" tone="muted">
        {t('search.lede')}
      </Text>
      <Field
        label={t('search.label')}
        help={t('search.help')}
        value={query}
        onChangeText={setQuery}
        identifier
        returnKeyType="search"
        onSubmitEditing={() => void search()}
      />
      <Button
        label={t('search.submit')}
        icon="search"
        busy={busy}
        disabled={query.trim().length === 0}
        onPress={() => void search()}
      />

      {error ? <Banner tone="danger" icon="alert" text={t(error)} /> : null}

      {result && result.length === 0 ? (
        <EmptyState icon="search" title={t('search.noneTitle')} body={t('search.noneBody')} />
      ) : null}

      {result?.map((customer) => (
        <Card key={customer.msisdn}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}>
            <Text variant="small" weight="600" style={{ flex: 1 }}>
              {customer.name[lang]}
            </Text>
            <Pill
              tone={
                customer.status === 'active'
                  ? 'ok'
                  : customer.status === 'barred'
                    ? 'danger'
                    : 'muted'
              }
              label={t(`search.status.${customer.status}`)}
            />
          </View>
          <DataRow label={t('search.label')} value={maskMsisdn(customer.msisdn)} identifier />
          {/* Masked, always. A full NID on a counter phone is a photograph
              waiting to happen, and nothing on this screen needs one. */}
          <DataRow label="NID" value={`••••${customer.nid.slice(-4)}`} identifier />
          <DataRow label={t('item.productSell')} value={customer.productName[lang]} />
          <DataRow
            label={t('search.activatedOn')}
            value={formatDate(customer.activatedOn, lang)}
          />
        </Card>
      ))}
    </Screen>
  )
}
