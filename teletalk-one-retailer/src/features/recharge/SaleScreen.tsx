import { useEffect, useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import {
  Banner,
  Button,
  Card,
  DataRow,
  Field,
  Screen,
  SectionHead,
  Text,
} from '../../components/ui'
import { useTheme } from '../../theme/ThemeProvider'
import {
  formatIdentifier,
  formatMoney,
  formatQuantity,
  maskMsisdn,
  toLatinDigits,
  type Lang,
} from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useSession } from '../auth/AuthProvider'
import { listProducts, queueRecharge } from '../activation/activationApi'
import { msisdnError } from '../activation/esafValidation'
import { MAX_RECHARGE, MIN_RECHARGE } from '../activation/esafValidation'
import { findSaleSpec } from './saleSpec'

/**
 * The over-the-counter sale: recharge, flexiload, powerload, TBPS, scratch
 * card and a product sale — one screen, six entries in the catalogue.
 *
 * Three fields at most and a confirmation. This is the transaction a retailer
 * does forty times a day with a customer waiting, so it is deliberately not a
 * wizard: a two-field form behind three taps would be slower than the till it
 * replaces.
 */
export function SaleScreen({ route }: { route?: { params?: { id?: string } } }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { space, colors, radius } = useTheme()
  const navigation = useNavigation<{
    goBack: () => void
    setOptions: (options: { title?: string }) => void
  }>()
  const session = useSession()

  const spec = findSaleSpec(route?.params?.id)
  const products = useResource('products', (signal) => listProducts(signal))

  // The header names the sale, not the route. "Sale" tells a retailer nothing
  // they did not already know; "Flexiload" tells them which of six they are in.
  useEffect(() => {
    if (spec) navigation.setOptions({ title: t(`item.${spec.id}`) })
  }, [navigation, spec, t])

  const [msisdn, setMsisdn] = useState('')
  const [amount, setAmount] = useState('')
  const [productCode, setProductCode] = useState('')
  const [queuedId, setQueuedId] = useState<string | null>(null)

  const value = Number(toLatinDigits(amount))
  const chosen = products.data?.find((p) => p.code === productCode)

  const errors = useMemo(() => {
    if (!spec) return { spec: 'error.notFound' }
    const found: Record<string, string> = {}
    if (spec.requiresMsisdn) {
      // Teletalk-only, because a recharge that leaves this counter has to land
      // on a Teletalk number — the money is settled against Teletalk's own CBS.
      const problem = msisdnError(msisdn, true)
      if (problem) found.msisdn = problem
    }
    if (spec.product && !productCode) found.productCode = 'error.required'
    if (!Number.isFinite(value) || value < MIN_RECHARGE || value > MAX_RECHARGE) {
      found.amount = 'error.rechargeRange'
    }
    return found
  }, [spec, msisdn, productCode, value])

  const ready = Object.keys(errors).length === 0

  if (!spec) {
    return (
      <Screen>
        <Banner tone="danger" icon="alert" text={t('error.notFound')} />
      </Screen>
    )
  }

  const submit = () => {
    const entry = queueRecharge({
      msisdn: spec.requiresMsisdn ? formatIdentifier(msisdn) : undefined,
      amount: value,
      posCode: session.posCode,
      channel: spec.channel,
      productCode: spec.product ? productCode : undefined,
    })
    setQueuedId(entry.id)
  }

  const startAnother = () => {
    setMsisdn('')
    setAmount('')
    setProductCode('')
    setQueuedId(null)
  }

  /* ------------------------------- receipt ------------------------------- */

  if (queuedId) {
    return (
      <Screen>
        {/* Queued, never "done". Nothing here has reached the server, and the
            one thing a retailer must not do is hand over the change on the
            strength of a screen that lied about it. */}
        <Banner tone="brand" icon="cloud" text={t('flow.queuedBody')} />
        <Card>
          <SectionHead title={t(`item.${spec.id}`)} />
          {spec.requiresMsisdn ? (
            <DataRow label={t('flow.msisdn')} value={maskMsisdn(msisdn)} identifier />
          ) : null}
          {chosen ? <DataRow label={t('flow.plan')} value={chosen.name[lang]} /> : null}
          <DataRow label={t('flow.amount')} value={formatMoney(value, lang)} />
          <DataRow label={t('outbox.reference')} value={queuedId} identifier />
        </Card>
        <Button label={t('wizard.startAnother')} icon="plus" onPress={startAnother} />
        <Button label={t('wizard.finish')} variant="secondary" onPress={navigation.goBack} />
      </Screen>
    )
  }

  /* -------------------------------- form --------------------------------- */

  return (
    <Screen>
      <Text variant="small" tone="muted">
        {t(`sale.intro.${spec.id}`)}
      </Text>

      <Card>
        {spec.requiresMsisdn ? (
          <Field
            label={t('flow.msisdn')}
            help={t('flow.msisdnTeletalkHelp')}
            value={msisdn}
            onChangeText={setMsisdn}
            error={msisdn.length > 0 && errors.msisdn ? t(errors.msisdn) : undefined}
            identifier
            maxLength={11}
            autoFocus
          />
        ) : null}

        {spec.product ? (
          <View style={{ gap: space.s2 }}>
            <Text variant="small" weight="600">
              {t('flow.plan')}
            </Text>
            <View style={{ gap: space.s2 }}>
              {(products.data ?? []).map((product) => (
                <Pressable
                  key={product.code}
                  onPress={() => {
                    setProductCode(product.code)
                    setAmount(String(product.price))
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: productCode === product.code }}
                  style={{
                    minHeight: 48,
                    justifyContent: 'center',
                    padding: space.s3,
                    borderRadius: radius.base,
                    backgroundColor:
                      productCode === product.code ? colors.brandWash : colors.surface,
                    borderWidth: 1,
                    borderColor:
                      productCode === product.code ? colors.brand : colors.ruleControl,
                  }}
                >
                  <Text variant="small" weight="600">
                    {product.name[lang]}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatMoney(product.price, lang)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* Denominations where the product has them, a free amount where it
            does not. Powerload is sold as a pack, and typing 173 into a pack
            price is a mistake the keypad should not make available. */}
        {spec.denominations.length > 0 ? (
          <View style={{ gap: space.s2 }}>
            <Text variant="small" weight="600">
              {t('flow.amount')}
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
              {spec.denominations.map((denomination) => {
                const on = value === denomination
                return (
                  <Pressable
                    key={denomination}
                    onPress={() => setAmount(String(denomination))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: on }}
                    style={{
                      minWidth: 84,
                      minHeight: 44,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: radius.base,
                      backgroundColor: on ? colors.brand : colors.surface,
                      borderWidth: 1,
                      borderColor: on ? colors.brand : colors.ruleControl,
                    }}
                  >
                    <Text variant="small" weight="700" tone={on ? 'onBrand' : 'ink'}>
                      {formatQuantity(denomination, lang)}
                    </Text>
                  </Pressable>
                )
              })}
            </View>
          </View>
        ) : (
          <Field
            label={t('flow.amount')}
            help={t('flow.amountHelp')}
            value={amount}
            onChangeText={setAmount}
            error={amount.length > 0 && errors.amount ? t(errors.amount) : undefined}
            identifier
            maxLength={5}
            editable={!spec.product}
          />
        )}

        <Button
          label={`${t(`sale.submit.${spec.id}`)} · ${formatMoney(
            Number.isFinite(value) ? value : 0,
            lang,
          )}`}
          icon="bolt"
          onPress={submit}
          disabled={!ready}
        />
      </Card>
    </Screen>
  )
}
