import { useState } from 'react'
import { Pressable, RefreshControl, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import {
  Banner,
  Button,
  Card,
  DataRow,
  Field,
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
  formatIdentifier,
  formatMoney,
  formatQuantity,
  toLatinDigits,
  type Lang,
} from '../../i18n/format'
import { useResource, type Resource } from '../../lib/useResource'
import { listProducts } from '../activation/activationApi'
import { useSession } from '../auth/AuthProvider'
import * as api from './opsApi'

/**
 * The three things a counter raises rather than reads: a requisition for more
 * stock, a complaint, and a look at the wallet the sales come out of.
 *
 * Both of the raising screens go through the outbox. That is not a detail —
 * the requisition a retailer raises at the end of the day is exactly the one
 * they raise while standing in a shop with no signal, and a form that fails on
 * submit is a form that gets filled in twice.
 */

function refresher(resource: Resource<unknown>) {
  return <RefreshControl refreshing={resource.loading} onRefresh={resource.reload} />
}

function view<T>(resource: Resource<T>, isEmpty?: (data: T) => boolean) {
  return {
    data: resource.data,
    loading: resource.loading,
    errorKey: resource.error,
    isEmpty: resource.data ? isEmpty?.(resource.data) : false,
  }
}

/* ------------------------------ requisition ------------------------------- */

const STAGE_TONE = {
  raised: 'warn',
  approved: 'brand',
  fulfilled: 'ok',
  rejected: 'danger',
} as const

export function RequisitionScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const session = useSession()

  const products = useResource('products', (signal) => listProducts(signal))
  const requisitions = useResource('requisitions', (signal) => api.getRequisitions(signal))

  const [quantities, setQuantities] = useState<Record<string, string>>({})
  const [note, setNote] = useState('')
  const [sent, setSent] = useState(false)

  const parsed = Object.fromEntries(
    Object.entries(quantities)
      .map(([code, raw]) => [code, Number(toLatinDigits(raw))] as const)
      .filter(([, n]) => Number.isFinite(n) && n > 0),
  )
  const total = Object.values(parsed).reduce((sum, n) => sum + n, 0)

  const send = () => {
    api.queueRequisition({ quantities: parsed, note: note.trim() || undefined }, session.posCode)
    setQuantities({})
    setNote('')
    setSent(true)
  }

  const mine = (requisitions.data ?? []).filter((r) => r.outletPosCode === session.posCode)

  return (
    <Screen refreshControl={refresher(requisitions)}>
      <Text variant="small" tone="muted">
        {t('req.ledeRaise')}
      </Text>

      {/* Queued, not sent. The wording matters: nothing here has reached the
          server, and telling a retailer "sent" would be the one lie this whole
          queue design exists to avoid. */}
      {sent ? <Banner tone="brand" icon="cloud" text={t('req.raised')} /> : null}

      <Card>
        <SectionHead title={t('req.new')} />
        <ResourceView
          state={view(products, (data) => data.length === 0)}
          emptyIcon="box"
          emptyTitle={t('req.emptyBody')}
          onRetry={products.reload}
        >
          {(data) => (
            <>
              {data.map((product) => (
                <Field
                  key={product.code}
                  label={product.name[lang]}
                  value={quantities[product.code] ?? ''}
                  onChangeText={(value) =>
                    setQuantities((prev) => ({ ...prev, [product.code]: value }))
                  }
                  identifier
                  placeholder="0"
                  maxLength={4}
                />
              ))}
              <Field
                label={t('complaint.detail')}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
              />
              <Text variant="caption" tone="muted">
                {t('req.lineCount', { count: Object.keys(parsed).length })} ·{' '}
                {t('req.totalUnits', { count: total })}
              </Text>
              <Button label={t('req.send')} icon="list" onPress={send} disabled={total === 0} />
            </>
          )}
        </ResourceView>
      </Card>

      <SectionHead title={t('req.mine')} />
      <ResourceView
        state={{
          data: mine,
          loading: requisitions.loading,
          errorKey: requisitions.error,
          isEmpty: mine.length === 0,
        }}
        emptyIcon="list"
        emptyTitle={t('req.mine')}
        emptyBody={t('req.emptyBody')}
        onRetry={requisitions.reload}
      >
        {(rows) => (
          <View style={{ gap: space.s2 }}>
            {rows.map((requisition) => (
              <Card key={requisition.id}>
                <View
                  style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                >
                  <Text variant="caption" tone="muted" identifier>
                    {requisition.id}
                  </Text>
                  <Pill
                    tone={STAGE_TONE[requisition.stage]}
                    label={t(`req.stage.${requisition.stage}`)}
                  />
                </View>
                <Text variant="small">
                  {formatDate(requisition.raisedOn, lang)} ·{' '}
                  {t('req.lineCount', { count: requisition.lines.length })}
                </Text>
                {requisition.lines.map((line) => (
                  <DataRow
                    key={line.productCode}
                    label={line.productName[lang]}
                    value={
                      line.approved === undefined
                        ? formatQuantity(line.requested, lang)
                        : `${formatQuantity(line.approved, lang)} / ${formatQuantity(line.requested, lang)}`
                    }
                  />
                ))}
              </Card>
            ))}
          </View>
        )}
      </ResourceView>
    </Screen>
  )
}

/* ------------------------------- complaints ------------------------------- */

const COMPLAINT_TONE = {
  open: 'warn',
  inProgress: 'brand',
  resolved: 'ok',
  closed: 'muted',
} as const

export function ComplaintScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space, colors, radius } = useTheme()

  const categories = useResource('complaint-categories', (signal) =>
    api.getComplaintCategories(signal),
  )
  const complaints = useResource('complaints', (signal) => api.getComplaints(signal))

  const [category, setCategory] = useState('')
  const [subject, setSubject] = useState('')
  const [detail, setDetail] = useState('')
  const [msisdn, setMsisdn] = useState('')
  const [sent, setSent] = useState(false)

  const chosen = categories.data?.find((c) => c.code === category)
  const ready = category !== '' && subject.trim().length > 0 && detail.trim().length > 0

  const send = () => {
    api.queueComplaint({
      category,
      subject: subject.trim(),
      detail: detail.trim(),
      msisdn: msisdn.trim() ? formatIdentifier(msisdn) : undefined,
    })
    setCategory('')
    setSubject('')
    setDetail('')
    setMsisdn('')
    setSent(true)
  }

  return (
    <Screen refreshControl={refresher(complaints)}>
      <Text variant="small" tone="muted">
        {t('complaint.ledeCreate')}
      </Text>
      {sent ? <Banner tone="brand" icon="cloud" text={t('complaint.raised')} /> : null}

      <Card>
        <Text variant="small" weight="600">
          {t('complaint.category')}
        </Text>
        {/* A row of chips rather than a picker. Six categories fit, and the
            native picker on Android is a modal that hides the form behind it. */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
          {(categories.data ?? []).map((option) => (
            <Pressable
              key={option.code}
              onPress={() => setCategory(option.code)}
              accessibilityRole="radio"
              accessibilityState={{ selected: category === option.code }}
              style={{
                minHeight: 40,
                justifyContent: 'center',
                paddingHorizontal: space.s4,
                borderRadius: radius.pill,
                backgroundColor: category === option.code ? colors.brand : colors.surface,
                borderWidth: 1,
                borderColor: category === option.code ? colors.brand : colors.ruleControl,
              }}
            >
              <Text
                variant="small"
                weight="600"
                tone={category === option.code ? 'onBrand' : 'ink'}
              >
                {option.label[lang]}
              </Text>
            </Pressable>
          ))}
        </View>
        {chosen ? (
          <Text variant="caption" tone="muted">
            {t('complaint.slaNote', { count: chosen.slaHours })}
          </Text>
        ) : null}

        <Field
          label={t('complaint.subject')}
          help={t('complaint.subjectHelp')}
          value={subject}
          onChangeText={setSubject}
          maxLength={120}
        />
        <Field
          label={t('complaint.detail')}
          help={t('complaint.detailHelp')}
          value={detail}
          onChangeText={setDetail}
          multiline
          numberOfLines={4}
        />
        <Field
          label={t('complaint.msisdn')}
          help={t('complaint.msisdnHelp')}
          value={msisdn}
          onChangeText={setMsisdn}
          identifier
          maxLength={11}
        />
        <Button label={t('complaint.send')} icon="ticket" onPress={send} disabled={!ready} />
      </Card>

      <SectionHead title={t('complaint.open')} />
      <ResourceView
        state={view(complaints, (data) => data.length === 0)}
        emptyIcon="ticket"
        emptyTitle={t('complaint.emptyTitle')}
        emptyBody={t('complaint.emptyBody')}
        onRetry={complaints.reload}
      >
        {(data) => (
          <View style={{ gap: space.s2 }}>
            {data.map((complaint) => {
              // Hours left on the SLA, counted down to the due time rather than
              // up from the raise — "6h left" is actionable, "18h ago" is not.
              const hours = Math.round(
                (new Date(complaint.slaDueOn).getTime() - Date.now()) / 3_600_000,
              )
              const done = complaint.status === 'resolved' || complaint.status === 'closed'
              return (
                <Card key={complaint.id}>
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                  >
                    <Text variant="caption" tone="muted" identifier>
                      {complaint.id}
                    </Text>
                    <Pill
                      tone={COMPLAINT_TONE[complaint.status]}
                      label={t(`complaint.status.${complaint.status}`)}
                    />
                  </View>
                  <Text variant="small" weight="600">
                    {complaint.subject}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {complaint.categoryLabel[lang]} · {formatDate(complaint.raisedOn, lang)}
                  </Text>
                  {!done ? (
                    <Text variant="caption" tone={hours < 0 ? 'danger' : 'warn'}>
                      {hours < 0
                        ? t('complaint.slaBreached', { count: Math.abs(hours) })
                        : t('complaint.slaLeft', { count: hours })}
                    </Text>
                  ) : null}
                  {complaint.updates.length > 0 ? (
                    <Text variant="caption" tone="muted">
                      {t('complaint.updates', { count: complaint.updates.length })}
                    </Text>
                  ) : null}
                </Card>
              )
            })}
          </View>
        )}
      </ResourceView>
    </Screen>
  )
}

/* --------------------------------- wallet --------------------------------- */

export function WalletScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space } = useTheme()
  const wallet = useResource('wallet', (signal) => api.getWallet(signal))

  return (
    <Screen refreshControl={refresher(wallet)}>
      <Text variant="small" tone="muted">
        {t('wallet.lede')}
      </Text>
      <ResourceView
        state={view(wallet)}
        emptyIcon="wallet"
        emptyTitle={t('wallet.ledger')}
        onRetry={wallet.reload}
      >
        {(data) => (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
              <Metric strong label={t('wallet.balance')} value={formatMoney(data.balance, lang)} />
              {data.creditLimit !== undefined ? (
                <Metric
                  label={t('wallet.creditLimit')}
                  value={formatMoney(data.creditLimit, lang)}
                  hint={t('wallet.headroom', {
                    amount: formatMoney(data.balance + data.creditLimit, lang),
                  })}
                />
              ) : null}
            </View>
            <SectionHead title={t('wallet.ledger')} />
            <View style={{ gap: space.s2 }}>
              {data.entries.map((entry) => (
                <Card key={entry.id}>
                  <View
                    style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.s3 }}
                  >
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text variant="small" weight="600">
                        {t(`wallet.kind.${entry.kind}`)}
                      </Text>
                      <Text variant="caption" tone="muted">
                        {formatDate(entry.at, lang)} ·{' '}
                        {t('wallet.after', { amount: formatMoney(entry.balanceAfter, lang) })}
                      </Text>
                      {entry.reference ? (
                        <Text variant="caption" tone="muted" identifier>
                          {entry.reference}
                        </Text>
                      ) : null}
                    </View>
                    {/* Sign, not colour alone: money leaving carries a minus in
                        the string as well as a red tone. */}
                    <Text
                      variant="small"
                      weight="700"
                      tone={entry.amount < 0 ? 'danger' : 'ok'}
                    >
                      {entry.amount < 0 ? '−' : '+'}
                      {formatMoney(Math.abs(entry.amount), lang)}
                    </Text>
                  </View>
                </Card>
              ))}
            </View>
          </>
        )}
      </ResourceView>
    </Screen>
  )
}
