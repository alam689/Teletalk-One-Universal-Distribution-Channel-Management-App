import { useCallback, useEffect, useMemo, useState } from 'react'
import { Alert, Pressable, Switch, View } from 'react-native'
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
  maskMsisdn,
  toLatinDigits,
  type Lang,
} from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { errorKey } from '../../lib/http'
import { useSession } from '../auth/AuthProvider'
import { useWizard } from '../wizard/useWizard'
import type { FieldErrors, StepContext, WizardStep } from '../wizard/types'
import * as api from './activationApi'
import { findFlowSpec, type FlowSpec, type StepKind } from './flowSpec'
import {
  maskNid,
  validateBiometric,
  validateEsaf,
  validateExistingNumber,
  validateRecharge,
  validateSimSelection,
} from './esafValidation'
import { EMPTY_FLOW_DATA, toEsafRequest, type FlowData, type Product } from './activationTypes'

/**
 * Every SIM transaction: activation, replacement, port-in, port-out, ownership
 * change and plan migration.
 *
 * One screen, six flows. The step list, whether the number must be a Teletalk
 * number, and whether the first recharge is offered all come from `flowSpec.ts`
 * — the same spec file the portal drives its version from, so a change to the
 * chain is a change in one place for both clients.
 *
 * The engine is `useWizard`, unchanged from the portal: it owns the draft, the
 * per-step validation, the double-tap guard and the resume, and each step is a
 * `render(ctx)` it calls. What differs here is only what a phone makes
 * different — a numeric keypad on every identifier, an OS-level confirm on
 * abandon, and the biometric step, which is the one place this app could
 * eventually do something the browser never could.
 */
export function FlowScreen({ route }: { route?: { params?: { id?: string } } }) {
  const { t } = useTranslation()
  const { space, colors, radius } = useTheme()
  const navigation = useNavigation<{
    goBack: () => void
    setOptions: (options: { title?: string }) => void
  }>()
  const session = useSession()

  const spec = findFlowSpec(route?.params?.id)
  const products = useResource('products', (signal) => api.listProducts(signal))
  const catalogue = products.data ?? []

  useEffect(() => {
    if (spec) navigation.setOptions({ title: t(`item.${spec.id}`) })
  }, [navigation, spec, t])

  const steps = useMemo<WizardStep<FlowData>[]>(
    () => (spec ? spec.steps.map((kind) => buildStep(kind, spec, catalogue, session.posCode)) : []),
    [spec, catalogue, session.posCode],
  )

  const wizard = useWizard<FlowData>({
    id: spec?.id ?? 'flow',
    version: spec?.version ?? 1,
    titleKey: spec ? `item.${spec.id}` : 'app.name',
    initialData: EMPTY_FLOW_DATA,
    steps: steps.length > 0 ? steps : [DONE_FALLBACK],
    // Never written to storage. A BVS reference identifies a capture session
    // against a citizen's biometric record; the draft is a convenience, and
    // convenience is not a reason to persist that.
    redact: ['biometric'],
  })

  const abandon = useCallback(() => {
    // The OS dialog rather than an in-app sheet: a half-entered e-SAF holds a
    // customer's NID, and this is the one confirmation that has to survive the
    // retailer already reaching for the back gesture.
    Alert.alert(t('wizard.abandonTitle'), t('wizard.abandonBody'), [
      { text: t('wizard.abandonKeep'), style: 'cancel' },
      {
        text: t('wizard.abandonDiscard'),
        style: 'destructive',
        onPress: () => {
          wizard.abandon()
          navigation.goBack()
        },
      },
    ])
  }, [navigation, t, wizard])

  if (!spec) {
    return (
      <Screen>
        <Banner tone="danger" icon="alert" text={t('error.notFound')} />
      </Screen>
    )
  }

  const { step, index, steps: live, commitError, busy, next, back, context } = wizard
  const total = live.length
  const terminal = step.terminal === true

  return (
    <Screen>
      {!terminal ? (
        <View style={{ gap: space.s2 }}>
          <Text variant="caption" tone="muted">
            {t('wizard.stepOf', { current: index + 1, total })} · {t(step.labelKey)}
          </Text>
          {/* The bar carries a label as well as a length — on its own it would
              be the only carrier of the information. */}
          <View
            style={{
              height: 6,
              borderRadius: radius.pill,
              backgroundColor: colors.surface3,
              overflow: 'hidden',
            }}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: total, now: index + 1 }}
          >
            <View
              style={{
                width: `${((index + 1) / total) * 100}%`,
                height: '100%',
                backgroundColor: colors.brand,
              }}
            />
          </View>
        </View>
      ) : null}

      {wizard.resumed && !terminal ? (
        <Banner tone="brand" icon="clock" text={t('wizard.resumed')} />
      ) : null}
      {commitError ? <Banner tone="danger" icon="alert" text={t(commitError)} /> : null}

      <Card>{step.render(context)}</Card>

      {/* Actions last and in a fixed order. A retailer working by muscle memory
          should find the same button in the same place on every step. */}
      {terminal ? (
        <>
          {/* `abandon` is the engine's "clear the draft, go back to step one",
              which is exactly what starting the next customer means. */}
          <Button label={t('wizard.startAnother')} icon="plus" onPress={wizard.abandon} />
          <Button label={t('wizard.finish')} variant="secondary" onPress={navigation.goBack} />
        </>
      ) : (
        <>
          <Button
            label={step.nextLabelKey ? t(step.nextLabelKey) : t('wizard.next')}
            onPress={next}
            busy={busy}
          />
          {index > 0 ? (
            <Button label={t('wizard.back')} variant="secondary" onPress={back} />
          ) : null}
          <Button label={t('wizard.cancel')} variant="ghost" onPress={abandon} />
        </>
      )}
    </Screen>
  )
}

/* ------------------------------- the steps -------------------------------- */

const DONE_FALLBACK: WizardStep<FlowData> = {
  id: 'done',
  labelKey: 'flow.step.done',
  terminal: true,
  render: () => null,
}

function buildStep(
  kind: StepKind,
  spec: FlowSpec,
  catalogue: Product[],
  posCode: string,
): WizardStep<FlowData> {
  switch (kind) {
    case 'sim':
      return {
        id: 'sim',
        labelKey: 'flow.step.sim',
        validate: (data) => validateSimSelection(data, spec.kind === 'activation'),
        render: (ctx) => <SimStep ctx={ctx} spec={spec} catalogue={catalogue} />,
      }
    case 'number':
      return {
        id: 'number',
        labelKey: 'flow.step.number',
        validate: (data) => validateExistingNumber(data, { teletalkOnly: spec.teletalkOnly }),
        render: (ctx) => <NumberStep ctx={ctx} spec={spec} catalogue={catalogue} />,
      }
    case 'identity':
      return {
        id: 'identity',
        labelKey: 'flow.step.identity',
        // The EC lookup is the step's own gate: without it the e-SAF would be
        // typed from whatever the customer said, which is the fraud this whole
        // chain exists to stop.
        validate: (data): FieldErrors =>
          data.nidVerifiedAt ? {} : { nid: 'error.nidNotVerified' },
        render: (ctx) => <IdentityStep ctx={ctx} />,
      }
    case 'esaf':
      return {
        id: 'esaf',
        labelKey: 'flow.step.esaf',
        validate: (data) => validateEsaf(data),
        render: (ctx) => <EsafStep ctx={ctx} />,
      }
    case 'biometric':
      return {
        id: 'biometric',
        labelKey: 'flow.step.biometric',
        validate: validateBiometric,
        render: (ctx) => <BiometricStep ctx={ctx} />,
      }
    case 'review':
      return {
        id: 'review',
        labelKey: 'flow.step.review',
        nextLabelKey: `flow.submit.${spec.kind}`,
        validate: (data) => (data.rechargeWanted && spec.recharge ? validateRecharge(data) : {}),
        commit: async (data) => {
          // The transaction and the first recharge are two queue entries, not
          // one. A recharge that fails must not roll back an activation that
          // succeeded — the customer keeps the SIM either way.
          const entry = api.queueTransaction(
            {
              kind: spec.kind,
              posCode,
              simSerial: data.simSerial || undefined,
              msisdn: data.msisdn || undefined,
              productCode: data.productCode || undefined,
              donorOperator: data.donorOperator || undefined,
              reasonCode: data.reasonCode || undefined,
              esaf: spec.steps.includes('esaf') ? toEsafRequest(data) : undefined,
              biometric: data.biometric ?? undefined,
            },
            data.outboxId || undefined,
          )
          const patch: Partial<FlowData> = { outboxId: entry.id }

          if (spec.recharge && data.rechargeWanted && data.rechargeAmount) {
            const recharge = api.queueRecharge(
              {
                msisdn: data.msisdn || undefined,
                amount: Number(toLatinDigits(data.rechargeAmount)),
                posCode,
                channel: 'sell',
              },
              data.rechargeOutboxId || undefined,
            )
            patch.rechargeOutboxId = recharge.id
          }
          return patch
        },
        render: (ctx) => <ReviewStep ctx={ctx} spec={spec} />,
      }
    case 'done':
      return {
        id: 'done',
        labelKey: 'flow.step.done',
        terminal: true,
        render: (ctx) => <DoneStep ctx={ctx} spec={spec} />,
      }
  }
}

/* ------------------------------ step bodies ------------------------------- */

type Ctx = StepContext<FlowData>

/** A row of chips. Six options fit; a native picker would hide the form. */
function Chooser({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  error?: string
}) {
  const { space, colors, radius } = useTheme()
  return (
    <View style={{ gap: space.s2 }}>
      <Text variant="small" weight="600">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
        {options.map((option) => {
          const on = value === option.value
          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={{
                minHeight: 44,
                justifyContent: 'center',
                paddingHorizontal: space.s4,
                borderRadius: radius.pill,
                backgroundColor: on ? colors.brand : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.brand : colors.ruleControl,
              }}
            >
              <Text variant="small" weight="600" tone={on ? 'onBrand' : 'ink'}>
                {option.label}
              </Text>
            </Pressable>
          )
        })}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  )
}

function useErr(ctx: Ctx) {
  const { t } = useTranslation()
  return (field: keyof FlowData) => (ctx.errors[field] ? t(ctx.errors[field]) : undefined)
}

function SimStep({ ctx, spec, catalogue }: { ctx: Ctx; spec: FlowSpec; catalogue: Product[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const err = useErr(ctx)
  return (
    <>
      <Text variant="small" tone="muted">
        {t('flow.simIntro')}
      </Text>
      <Field
        label={t('flow.simSerial')}
        help={t('flow.simSerialHelp')}
        value={ctx.data.simSerial}
        onChangeText={(simSerial) => ctx.update({ simSerial })}
        error={err('simSerial')}
        identifier
        maxLength={20}
        autoFocus
      />
      {spec.kind === 'activation' ? (
        <>
          <Chooser
            label={t('flow.plan')}
            value={ctx.data.productCode}
            onChange={(productCode) => ctx.update({ productCode })}
            error={err('productCode')}
            options={catalogue.map((product) => ({
              value: product.code,
              label: product.name[lang],
            }))}
          />
          {/* Said out loud, because a retailer looking for a number field will
              otherwise wait for one. CBS assigns it after the queue lands. */}
          <Text variant="caption" tone="muted">
            {t('flow.msisdnAssigned')}
          </Text>
        </>
      ) : null}
    </>
  )
}

function NumberStep({ ctx, spec, catalogue }: { ctx: Ctx; spec: FlowSpec; catalogue: Product[] }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const err = useErr(ctx)
  return (
    <>
      <Field
        label={t('flow.msisdn')}
        help={spec.teletalkOnly ? t('flow.msisdnTeletalkHelp') : t('flow.msisdnAnyHelp')}
        value={ctx.data.msisdn}
        onChangeText={(msisdn) => ctx.update({ msisdn })}
        error={err('msisdn')}
        identifier
        maxLength={11}
        autoFocus
      />
      {spec.kind === 'portIn' ? (
        <Chooser
          label={t('flow.donor')}
          value={ctx.data.donorOperator}
          onChange={(donorOperator) => ctx.update({ donorOperator })}
          error={err('donorOperator')}
          options={['grameenphone', 'robi', 'banglalink', 'airtel'].map((code) => ({
            value: code,
            label: code,
          }))}
        />
      ) : null}
      {spec.kind === 'replacement' ? (
        <Chooser
          label={t('flow.reason')}
          value={ctx.data.reasonCode}
          onChange={(reasonCode) => ctx.update({ reasonCode })}
          error={err('reasonCode')}
          options={['lost', 'damaged', 'stolen', 'upgrade'].map((code) => ({
            value: code,
            label: t(`reason.${code}`),
          }))}
        />
      ) : null}
      {spec.kind === 'planMigration' ? (
        <Chooser
          label={t('flow.targetPlan')}
          value={ctx.data.productCode}
          onChange={(productCode) => ctx.update({ productCode })}
          error={err('productCode')}
          options={catalogue.map((product) => ({ value: product.code, label: product.name[lang] }))}
        />
      ) : null}
    </>
  )
}

/**
 * The EC/NID lookup. Two fields, because an NID number on its own must never
 * return a citizen's record — the date of birth is the second factor.
 */
function IdentityStep({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation()
  const err = useErr(ctx)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const lookup = async () => {
    setBusy(true)
    setFailed(null)
    try {
      const record = await api.checkNid(formatIdentifier(ctx.data.nid), ctx.data.dateOfBirth)
      ctx.update({
        nameBn: record.nameBn,
        nameEn: record.nameEn,
        fatherNameBn: record.fatherNameBn,
        motherNameBn: record.motherNameBn,
        gender: record.gender,
        division: record.division,
        district: record.district,
        upazila: record.upazila,
        postCode: record.postCode,
        addressLine: record.addressLine,
        simsOnNid: record.simsOnNid,
        nidVerifiedAt: new Date().toISOString(),
      })
    } catch (error) {
      setFailed(errorKey(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Text variant="small" tone="muted">
        {t('flow.identityIntro')}
      </Text>
      <Field
        label={t('esaf.nid')}
        help={t('esaf.nidHelp')}
        value={ctx.data.nid}
        onChangeText={(nid) => ctx.update({ nid, nidVerifiedAt: '' })}
        error={err('nid')}
        identifier
        maxLength={17}
        autoFocus
      />
      <Field
        label={t('esaf.dob')}
        help={t('esaf.dobHelp')}
        value={ctx.data.dateOfBirth}
        onChangeText={(dateOfBirth) => ctx.update({ dateOfBirth, nidVerifiedAt: '' })}
        error={err('dateOfBirth')}
        identifier
        placeholder="YYYY-MM-DD"
        maxLength={10}
      />
      {failed ? <Banner tone="danger" icon="alert" text={t(failed)} /> : null}
      {ctx.data.nidVerifiedAt ? (
        <>
          <Banner tone="ok" icon="check" text={t('esaf.prefilled')} />
          {/* 15 is the BTRC ceiling. Knowing before the e-SAF is filled in is
              the difference between a warning and a wasted ten minutes. */}
          {ctx.data.simsOnNid >= 10 ? (
            <Banner
              tone="warn"
              icon="alert"
              text={t('esaf.simLimitWarning', { count: ctx.data.simsOnNid })}
            />
          ) : null}
        </>
      ) : (
        <Button label={t('search.submit')} icon="search" busy={busy} onPress={() => void lookup()} />
      )}
    </>
  )
}

/** The e-SAF. Prefilled from the EC record; every field still editable. */
function EsafStep({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation()
  const { space, colors } = useTheme()
  const err = useErr(ctx)
  const { data, update } = ctx

  const Consent = ({
    label,
    help,
    value,
    onChange,
    error,
  }: {
    label: string
    help: string
    value: boolean
    onChange: (value: boolean) => void
    error?: string
  }) => (
    <View style={{ gap: space.s1 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: space.s3,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text variant="small" weight="600">
            {label}
          </Text>
          <Text variant="caption" tone="muted">
            {help}
          </Text>
        </View>
        <Switch
          value={value}
          onValueChange={onChange}
          accessibilityLabel={label}
          trackColor={{ true: colors.brand, false: colors.surface3 }}
        />
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : null}
    </View>
  )

  return (
    <>
      <SectionHead title={t('esaf.sectionName')} />
      <Field
        label={t('esaf.nameBn')}
        help={t('esaf.nameBnHelp')}
        value={data.nameBn}
        onChangeText={(nameBn) => update({ nameBn })}
        error={err('nameBn')}
      />
      <Field
        label={t('esaf.nameEn')}
        help={t('esaf.nameEnHelp')}
        value={data.nameEn}
        onChangeText={(nameEn) => update({ nameEn })}
        error={err('nameEn')}
        autoCapitalize="characters"
      />
      <Field
        label={t('esaf.fatherName')}
        value={data.fatherNameBn}
        onChangeText={(fatherNameBn) => update({ fatherNameBn })}
        error={err('fatherNameBn')}
      />
      <Field
        label={t('esaf.motherName')}
        value={data.motherNameBn}
        onChangeText={(motherNameBn) => update({ motherNameBn })}
        error={err('motherNameBn')}
      />

      <SectionHead title={t('esaf.sectionAddress')} />
      <Field
        label={t('esaf.division')}
        value={data.division}
        onChangeText={(division) => update({ division })}
        error={err('division')}
      />
      <Field
        label={t('esaf.district')}
        value={data.district}
        onChangeText={(district) => update({ district })}
        error={err('district')}
      />
      <Field
        label={t('esaf.upazila')}
        value={data.upazila}
        onChangeText={(upazila) => update({ upazila })}
        error={err('upazila')}
      />
      <Field
        label={t('esaf.postCode')}
        value={data.postCode}
        onChangeText={(postCode) => update({ postCode })}
        error={err('postCode')}
        identifier
        maxLength={4}
      />
      <Field
        label={t('esaf.addressLine')}
        help={t('esaf.addressLineHelp')}
        value={data.addressLine}
        onChangeText={(addressLine) => update({ addressLine })}
        error={err('addressLine')}
        multiline
        numberOfLines={2}
      />
      <Field
        label={t('esaf.contact')}
        help={t('esaf.contactHelp')}
        value={data.contactMsisdn}
        onChangeText={(contactMsisdn) => update({ contactMsisdn })}
        error={err('contactMsisdn')}
        identifier
        maxLength={11}
      />

      <SectionHead title={t('esaf.sectionConsent')} />
      {/* Two consents, and only the first is required. The marketing one is
          never pre-ticked — a default-on consent is not a consent. */}
      <Consent
        label={t('esaf.consentKyc')}
        help={t('esaf.consentKycHelp')}
        value={data.consentKyc}
        onChange={(consentKyc) => update({ consentKyc })}
        error={err('consentKyc')}
      />
      <Consent
        label={t('esaf.consentMarketing')}
        help={t('esaf.consentMarketingHelp')}
        value={data.consentMarketing}
        onChange={(consentMarketing) => update({ consentMarketing })}
      />
    </>
  )
}

/**
 * The honest version of this step.
 *
 * A fingerprint reader on the handset authenticates the *retailer*; BVS
 * enrolment is a capture against the citizen's record on a certified device.
 * So this asks for the reference that device gives, and says why — the same
 * position the portal took, for a different reason.
 */
function BiometricStep({ ctx }: { ctx: Ctx }) {
  const { t } = useTranslation()
  const err = useErr(ctx)
  return (
    <>
      <Banner tone="warn" icon="shield" text={t('flow.biometricDeviceLimit')} />
      <Text variant="small" tone="soft">
        {t('flow.biometricSteps')}
      </Text>
      <Field
        label={t('flow.biometricReference')}
        help={t('flow.biometricReferenceHelp')}
        value={ctx.data.biometric?.reference ?? ''}
        onChangeText={(reference) =>
          ctx.update({
            biometric: reference
              ? {
                  method: 'fingerprint',
                  reference: formatIdentifier(reference),
                  capturedAt: new Date().toISOString(),
                }
              : null,
          })
        }
        error={err('biometric')}
        identifier
        maxLength={20}
      />
    </>
  )
}

function ReviewStep({ ctx, spec }: { ctx: Ctx; spec: FlowSpec }) {
  const { t } = useTranslation()
  const { space, colors } = useTheme()
  const err = useErr(ctx)
  const { data, update } = ctx

  return (
    <>
      <Text variant="small" tone="muted">
        {t('flow.reviewIntro')}
      </Text>
      <DataRow label={t('flow.transaction')} value={t(`flow.kind.${spec.kind}`)} />
      {data.simSerial ? (
        <DataRow label={t('flow.simSerial')} value={data.simSerial} identifier />
      ) : null}
      {data.msisdn ? (
        <DataRow label={t('flow.msisdn')} value={maskMsisdn(data.msisdn)} identifier />
      ) : null}
      {/* Masked on the review too. The retailer has already seen it typed; a
          full NID sitting on a bright screen at a counter is a photograph
          waiting to be taken by whoever is next in the queue. */}
      {data.nid ? <DataRow label={t('esaf.nid')} value={maskNid(data.nid)} identifier /> : null}
      {data.nameBn ? <DataRow label={t('esaf.nameBn')} value={data.nameBn} /> : null}
      {data.biometric ? (
        <DataRow
          label={t('flow.biometricReference')}
          value={data.biometric.reference}
          identifier
        />
      ) : null}
      {spec.steps.includes('esaf') ? (
        <DataRow
          label={t('flow.consentGiven')}
          value={data.consentKyc ? t('esaf.consentKyc') : '—'}
        />
      ) : null}

      {spec.recharge ? (
        <View style={{ gap: space.s3, marginTop: space.s3 }}>
          <SectionHead title={t('flow.firstRecharge')} />
          <Text variant="small" tone="muted">
            {t('flow.firstRechargeIntro')}
          </Text>
          <View
            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
          >
            <Text variant="small" weight="600">
              {t('flow.rechargeNow')}
            </Text>
            <Switch
              value={data.rechargeWanted}
              onValueChange={(rechargeWanted) => update({ rechargeWanted })}
              accessibilityLabel={t('flow.rechargeNow')}
              trackColor={{ true: colors.brand, false: colors.surface3 }}
            />
          </View>
          {data.rechargeWanted ? (
            <Field
              label={t('flow.amount')}
              help={t('flow.amountHelp')}
              value={data.rechargeAmount}
              onChangeText={(rechargeAmount) => update({ rechargeAmount })}
              error={err('rechargeAmount')}
              identifier
              maxLength={5}
            />
          ) : null}
        </View>
      ) : null}

      <Banner tone="warn" icon="alert" text={t('flow.reviewWarning')} />
    </>
  )
}

/**
 * Queued, not done.
 *
 * Nothing on this screen has reached the server. The wording, the icon and the
 * tone all say so, because the one failure this queue exists to prevent is a
 * retailer handing over a SIM on the strength of a screen that lied.
 */
function DoneStep({ ctx, spec }: { ctx: Ctx; spec: FlowSpec }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { data } = ctx
  return (
    <>
      <Banner tone="brand" icon="cloud" text={t('flow.queuedBody')} />
      <DataRow label={t('flow.transaction')} value={t(`flow.kind.${spec.kind}`)} />
      {data.msisdn ? <DataRow label={t('flow.msisdn')} value={data.msisdn} identifier /> : null}
      <DataRow label={t('outbox.reference')} value={data.outboxId} identifier />
      {data.rechargeOutboxId ? (
        <DataRow
          label={t('flow.firstRecharge')}
          value={formatMoney(Number(toLatinDigits(data.rechargeAmount)), lang)}
        />
      ) : null}
    </>
  )
}
