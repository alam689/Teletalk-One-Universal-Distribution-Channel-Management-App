import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Checkbox, Field, Select } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { formatIdentifier, formatMoney, type Lang } from '../../i18n/format'
import { logger } from '../../lib/logger'
import { outbox } from '../../lib/outbox'
import { useOutboxEntry } from '../outbox/useOutbox'
import type { StepContext } from '../wizard/types'
import { listProducts, queueRecharge } from './activationApi'
import {
  NID_SIM_LIMIT,
  type FlowData,
  type Product,
  type RechargeResult,
  type TransactionResult,
} from './activationTypes'
import { DIVISIONS, maskNid, maskReference, validateRecharge } from './esafValidation'
import type { FlowSpec } from './flowSpec'

/**
 * The step bodies. Each one is a component — the engine calls `render(ctx)` and
 * gets a component back, so hooks are legal inside a step and the engine still
 * knows nothing about SIMs.
 *
 * Identifier discipline runs through every field here: anything the retailer
 * will dictate over the phone or that BVS/CBS will match on (POS code, MSISDN,
 * NID, SIM serial, transaction id) is normalised to Latin digits on each
 * keystroke and rendered monospaced, in both locales.
 */

export interface StepProps {
  ctx: StepContext<FlowData>
  spec: FlowSpec
  /** The signed-in outlet. Every transaction is booked against it. */
  posCode: string
}

const ID_INPUT = { inputMode: 'numeric' as const, autoComplete: 'off' as const }

/** Errors arrive as i18n keys, never prose. */
function useErr(errors: Record<string, string>) {
  const { t } = useTranslation()
  return (field: string) => (errors[field] ? t(errors[field]) : undefined)
}

function useLang(): Lang {
  const { i18n } = useTranslation()
  return i18n.language === 'en' ? 'en' : 'bn'
}

/* ------------------------------- products ------------------------------- */

function useProducts(): Product[] {
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    const controller = new AbortController()
    listProducts(controller.signal)
      .then(setProducts)
      .catch((err: unknown) => logger.warn('product list unavailable', { err }))
    return () => controller.abort()
  }, [])
  return products
}

function ProductSelect({
  ctx,
  products,
  labelKey,
}: {
  ctx: StepContext<FlowData>
  products: Product[]
  labelKey: string
}) {
  const { t } = useTranslation()
  const lang = useLang()
  const err = useErr(ctx.errors)

  return (
    <Select
      id="productCode"
      label={t(labelKey)}
      placeholder={t('flow.choosePlan')}
      value={ctx.data.productCode}
      error={err('productCode')}
      onChange={(e) => ctx.update({ productCode: e.target.value })}
      options={products.map((p) => ({
        value: p.code,
        label: `${p.name[lang]} — ${formatMoney(p.price, lang)}`,
      }))}
    />
  )
}

/* --------------------------------- SIM ---------------------------------- */

export function SimStep({ ctx, spec }: StepProps) {
  const { t } = useTranslation()
  const err = useErr(ctx.errors)
  const products = useProducts()

  return (
    <div className="wiz__section">
      <p className="wiz__note">{t('flow.simIntro')}</p>
      <Field
        id="simSerial"
        label={t('flow.simSerial')}
        help={t('flow.simSerialHelp')}
        placeholder="8988015..."
        identifier
        maxLength={20}
        value={ctx.data.simSerial}
        error={err('simSerial')}
        onChange={(e) => ctx.update({ simSerial: formatIdentifier(e.target.value) })}
        {...ID_INPUT}
      />
      {spec.kind === 'activation' && (
        <ProductSelect ctx={ctx} products={products} labelKey="flow.plan" />
      )}
      {spec.kind === 'activation' && <p className="wiz__note">{t('flow.msisdnAssigned')}</p>}
    </div>
  )
}

/* ------------------------------ the number ------------------------------ */

const DONOR_OPERATORS = ['Grameenphone', 'Robi', 'Banglalink', 'Airtel'] as const
const REPLACEMENT_REASONS = ['lost', 'stolen', 'damaged', 'upgrade'] as const

export function NumberStep({ ctx, spec }: StepProps) {
  const { t } = useTranslation()
  const err = useErr(ctx.errors)
  const products = useProducts()

  return (
    <div className="wiz__section">
      <Field
        id="msisdn"
        label={t('flow.msisdn')}
        help={spec.teletalkOnly ? t('flow.msisdnTeletalkHelp') : t('flow.msisdnAnyHelp')}
        placeholder={spec.teletalkOnly ? '015XXXXXXXX' : '01XXXXXXXXX'}
        identifier
        maxLength={11}
        value={ctx.data.msisdn}
        error={err('msisdn')}
        onChange={(e) => ctx.update({ msisdn: formatIdentifier(e.target.value) })}
        {...ID_INPUT}
      />

      {spec.kind === 'replacement' && (
        <Select
          id="reasonCode"
          label={t('flow.reason')}
          placeholder={t('flow.chooseReason')}
          value={ctx.data.reasonCode}
          error={err('reasonCode')}
          onChange={(e) => ctx.update({ reasonCode: e.target.value })}
          options={REPLACEMENT_REASONS.map((r) => ({ value: r, label: t(`reason.${r}`) }))}
        />
      )}

      {spec.kind === 'portIn' && (
        <Select
          id="donorOperator"
          label={t('flow.donor')}
          help={t('flow.donorHelp')}
          placeholder={t('flow.chooseDonor')}
          value={ctx.data.donorOperator}
          error={err('donorOperator')}
          onChange={(e) => ctx.update({ donorOperator: e.target.value })}
          options={DONOR_OPERATORS.map((o) => ({ value: o, label: o }))}
        />
      )}

      {spec.kind === 'planMigration' && (
        <ProductSelect ctx={ctx} products={products} labelKey="flow.targetPlan" />
      )}
    </div>
  )
}

/* ------------------------------- identity ------------------------------- */

export function IdentityStep({ ctx }: StepProps) {
  const { t } = useTranslation()
  const err = useErr(ctx.errors)

  return (
    <div className="wiz__section">
      <p className="wiz__note">{t('flow.identityIntro')}</p>
      <Field
        id="nid"
        label={t('esaf.nid')}
        help={t('esaf.nidHelp')}
        identifier
        maxLength={17}
        value={ctx.data.nid}
        error={err('nid')}
        onChange={(e) => ctx.update({ nid: formatIdentifier(e.target.value) })}
        {...ID_INPUT}
      />
      <Field
        id="dateOfBirth"
        label={t('esaf.dob')}
        help={t('esaf.dobHelp')}
        type="date"
        value={ctx.data.dateOfBirth}
        error={err('dateOfBirth')}
        onChange={(e) => ctx.update({ dateOfBirth: e.target.value })}
      />
    </div>
  )
}

/* --------------------------------- e-SAF -------------------------------- */

export function EsafStep({ ctx }: StepProps) {
  const { t } = useTranslation()
  const err = useErr(ctx.errors)
  const { data } = ctx
  const nearLimit = data.simsOnNid >= NID_SIM_LIMIT - 1

  return (
    <div className="wiz__section">
      {data.nidVerifiedAt && (
        <div className="wiz__resumed" role="status">
          {t('esaf.prefilled')}
        </div>
      )}
      {nearLimit && (
        <Alert tone="warn">
          {t('esaf.simLimitWarning', { count: data.simsOnNid, limit: NID_SIM_LIMIT })}
        </Alert>
      )}

      <p className="wiz__legend">{t('esaf.sectionName')}</p>
      <div className="wiz__grid">
        <Field
          id="nameBn"
          label={t('esaf.nameBn')}
          help={t('esaf.nameBnHelp')}
          lang="bn"
          value={data.nameBn}
          error={err('nameBn')}
          onChange={(e) => ctx.update({ nameBn: e.target.value })}
        />
        <Field
          id="nameEn"
          label={t('esaf.nameEn')}
          help={t('esaf.nameEnHelp')}
          lang="en"
          value={data.nameEn}
          error={err('nameEn')}
          onChange={(e) => ctx.update({ nameEn: e.target.value })}
        />
        <Field
          id="fatherNameBn"
          label={t('esaf.fatherName')}
          lang="bn"
          value={data.fatherNameBn}
          error={err('fatherNameBn')}
          onChange={(e) => ctx.update({ fatherNameBn: e.target.value })}
        />
        <Field
          id="motherNameBn"
          label={t('esaf.motherName')}
          lang="bn"
          value={data.motherNameBn}
          error={err('motherNameBn')}
          onChange={(e) => ctx.update({ motherNameBn: e.target.value })}
        />
      </div>

      <p className="wiz__legend">{t('esaf.sectionIdentity')}</p>
      <div className="wiz__grid">
        <Field
          id="esafDob"
          label={t('esaf.dob')}
          type="date"
          value={data.dateOfBirth}
          error={err('dateOfBirth')}
          onChange={(e) => ctx.update({ dateOfBirth: e.target.value })}
        />
        <Select
          id="gender"
          label={t('esaf.gender')}
          placeholder={t('esaf.chooseGender')}
          value={data.gender}
          error={err('gender')}
          onChange={(e) => ctx.update({ gender: e.target.value as FlowData['gender'] })}
          options={[
            { value: 'male', label: t('gender.male') },
            { value: 'female', label: t('gender.female') },
            { value: 'other', label: t('gender.other') },
          ]}
        />
        <Field
          id="esafNid"
          label={t('esaf.nid')}
          identifier
          maxLength={17}
          value={data.nid}
          error={err('nid')}
          onChange={(e) => ctx.update({ nid: formatIdentifier(e.target.value) })}
          {...ID_INPUT}
        />
        <Field
          id="contactMsisdn"
          label={t('esaf.contact')}
          help={t('esaf.contactHelp')}
          identifier
          maxLength={11}
          value={data.contactMsisdn}
          error={err('contactMsisdn')}
          onChange={(e) => ctx.update({ contactMsisdn: formatIdentifier(e.target.value) })}
          {...ID_INPUT}
        />
      </div>

      <p className="wiz__legend">{t('esaf.sectionAddress')}</p>
      <div className="wiz__grid">
        <Select
          id="division"
          label={t('esaf.division')}
          placeholder={t('esaf.chooseDivision')}
          value={data.division}
          error={err('division')}
          onChange={(e) => ctx.update({ division: e.target.value })}
          options={DIVISIONS.map((d) => ({ value: d, label: t(`division.${d}`) }))}
        />
        <Field
          id="district"
          label={t('esaf.district')}
          value={data.district}
          error={err('district')}
          onChange={(e) => ctx.update({ district: e.target.value })}
        />
        <Field
          id="upazila"
          label={t('esaf.upazila')}
          value={data.upazila}
          error={err('upazila')}
          onChange={(e) => ctx.update({ upazila: e.target.value })}
        />
        <Field
          id="postCode"
          label={t('esaf.postCode')}
          identifier
          maxLength={4}
          value={data.postCode}
          error={err('postCode')}
          onChange={(e) => ctx.update({ postCode: formatIdentifier(e.target.value) })}
          {...ID_INPUT}
        />
      </div>
      <Field
        id="addressLine"
        label={t('esaf.addressLine')}
        help={t('esaf.addressLineHelp')}
        lang="bn"
        value={data.addressLine}
        error={err('addressLine')}
        onChange={(e) => ctx.update({ addressLine: e.target.value })}
      />

      <p className="wiz__legend">{t('esaf.sectionConsent')}</p>
      <Checkbox
        id="consentKyc"
        label={t('esaf.consentKyc')}
        help={t('esaf.consentKycHelp')}
        checked={data.consentKyc}
        onChange={(v) => ctx.update({ consentKyc: v })}
      />
      {ctx.errors.consentKyc && (
        <p className="field__error" role="alert">
          {t(ctx.errors.consentKyc)}
        </p>
      )}
      <Checkbox
        id="consentMarketing"
        label={t('esaf.consentMarketing')}
        help={t('esaf.consentMarketingHelp')}
        checked={data.consentMarketing}
        onChange={(v) => ctx.update({ consentMarketing: v })}
      />
    </div>
  )
}

/* ------------------------------- biometric ------------------------------ */

/**
 * The honest version of biometric capture on web.
 *
 * A browser cannot read a fingerprint scanner, and pretending otherwise would
 * put a stub in front of the one control BTRC actually audits. So the web
 * client records *which* external capture happened and its BVS reference; the
 * React Native app replaces this step with a real capture and the contract
 * (`BiometricCapture`) does not change when it does.
 */
export function BiometricStep({ ctx }: StepProps) {
  const { t } = useTranslation()
  const err = useErr(ctx.errors)
  const reference = ctx.data.biometric?.reference ?? ''

  const setReference = (value: string) =>
    ctx.update({
      biometric: {
        method: 'device',
        reference: value,
        capturedAt: new Date().toISOString(),
      },
    })

  return (
    <div className="wiz__section">
      <Alert tone="warn">{t('flow.biometricWebLimit')}</Alert>
      <p className="wiz__note">{t('flow.biometricSteps')}</p>
      <Field
        id="biometric"
        label={t('flow.biometricReference')}
        help={t('flow.biometricReferenceHelp')}
        identifier
        maxLength={24}
        value={reference}
        error={err('biometric')}
        onChange={(e) => setReference(formatIdentifier(e.target.value))}
        {...ID_INPUT}
      />
    </div>
  )
}

/* -------------------------------- review -------------------------------- */

function Row({ label, value, id = false }: { label: string; value: string; id?: boolean }) {
  if (!value) return null
  return (
    <div className="wiz__row">
      <dt>{label}</dt>
      <dd className={id ? 'identifier' : undefined}>{value}</dd>
    </div>
  )
}

export function ReviewStep({ ctx, spec }: StepProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const { data } = ctx
  const products = useProducts()
  const product = products.find((p) => p.code === data.productCode)

  return (
    <div className="wiz__section">
      <p className="wiz__note">{t('flow.reviewIntro')}</p>
      <dl className="wiz__review">
        <Row label={t('flow.transaction')} value={t(`flow.kind.${spec.kind}`)} />
        <Row label={t('flow.simSerial')} value={data.simSerial} id />
        <Row label={t('flow.msisdn')} value={data.msisdn} id />
        <Row label={t('flow.plan')} value={product ? product.name[lang] : ''} />
        <Row label={t('flow.donor')} value={data.donorOperator} />
        <Row
          label={t('flow.reason')}
          value={data.reasonCode ? t(`reason.${data.reasonCode}`) : ''}
        />
        <Row label={t('esaf.nameBn')} value={data.nameBn} />
        <Row label={t('esaf.nameEn')} value={data.nameEn} />
        {/* Masked. A counter screen faces the queue standing behind the customer. */}
        <Row label={t('esaf.nid')} value={data.nid ? maskNid(data.nid) : ''} id />
        <Row label={t('esaf.contact')} value={data.contactMsisdn} id />
        <Row
          label={t('esaf.address')}
          value={[data.addressLine, data.upazila, data.district, data.postCode]
            .filter(Boolean)
            .join(', ')}
        />
        <Row
          label={t('flow.biometricReference')}
          value={data.biometric ? maskReference(data.biometric.reference) : ''}
          id
        />
        <Row
          label={t('esaf.consentKyc')}
          value={data.consentKyc ? t('flow.consentGiven') : ''}
        />
      </dl>
      <p className="wiz__note">{t('flow.reviewWarning')}</p>
    </div>
  )
}

/* --------------------------------- done --------------------------------- */

const QUICK_AMOUNTS = [20, 50, 100, 200, 500]

function isTransactionResult(value: unknown): value is TransactionResult {
  return typeof value === 'object' && value !== null && 'transactionId' in value
}

/**
 * The terminal step, and the one that carries the queue's honesty rule: a
 * mutation the server has not confirmed is rendered as *pending*, never as
 * done. The recharge panel stays closed until the activation actually settles,
 * because recharging a number CBS has not issued yet is money into a void.
 */
export function DoneStep({ ctx, spec, posCode }: StepProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const { data } = ctx
  const entry = useOutboxEntry(data.outboxId || null)
  const result = isTransactionResult(entry?.result) ? entry.result : null

  // CBS assigns the number; until it answers, we do not have one to show.
  useEffect(() => {
    if (result?.msisdn && result.msisdn !== data.msisdn) ctx.update({ msisdn: result.msisdn })
  }, [result?.msisdn, data.msisdn, ctx, result])

  const settled = entry?.status === 'settled'
  const failed = entry?.status === 'failed'

  return (
    <div className="wiz__section">
      <div className="wiz__done">
        <span className={`wiz__doneIcon${settled ? '' : ' wiz__doneIcon--pending'}`}>
          <Icon name={settled ? 'check' : failed ? 'bell' : 'clock'} size={26} />
        </span>
        <h2 className="wiz__doneTitle">
          {settled
            ? t(`flow.done.${spec.kind}`)
            : failed
              ? t('flow.failedTitle')
              : t('flow.queuedTitle')}
        </h2>
        {!settled && !failed && <p className="wiz__note">{t('flow.queuedBody')}</p>}
        {failed && <Alert tone="danger">{t(entry?.errorKey ?? 'error.generic')}</Alert>}
      </div>

      {settled && result && (
        <dl className="wiz__review">
          <Row label={t('flow.transactionId')} value={result.transactionId} id />
          <Row label={t('flow.msisdn')} value={result.msisdn} id />
          <Row label={t('flow.status')} value={t(`flow.state.${result.status}`)} />
        </dl>
      )}

      {failed && (
        <Button variant="ghost" onClick={() => outbox.retry(data.outboxId)}>
          {t('flow.retry')}
        </Button>
      )}

      {spec.recharge && settled && result?.status === 'active' && (
        <RechargePanel ctx={ctx} lang={lang} msisdn={result.msisdn} posCode={posCode} />
      )}
    </div>
  )
}

/* --------------------------- inline first recharge --------------------------- */

function isRechargeResult(value: unknown): value is RechargeResult {
  return typeof value === 'object' && value !== null && 'balanceAfter' in value
}

function RechargePanel({
  ctx,
  lang,
  msisdn,
  posCode,
}: {
  ctx: StepContext<FlowData>
  lang: Lang
  msisdn: string
  posCode: string
}) {
  const { t } = useTranslation()
  const { data } = ctx
  const [error, setError] = useState<string | null>(null)
  const entry = useOutboxEntry(data.rechargeOutboxId || null)
  const result = isRechargeResult(entry?.result) ? entry.result : null

  const submit = () => {
    const found = validateRecharge({ ...data, rechargeWanted: true })
    if (found.rechargeAmount) {
      setError(found.rechargeAmount)
      return
    }
    setError(null)
    const queued = queueRecharge({
      msisdn,
      amount: Number(formatIdentifier(data.rechargeAmount)),
      posCode,
      channel: 'sell',
    })
    ctx.update({ rechargeOutboxId: queued.id })
  }

  if (entry) {
    return (
      <div className="wiz__section">
        <p className="wiz__legend">{t('flow.firstRecharge')}</p>
        {entry.status === 'settled' && result ? (
          <>
            <Alert tone="ok">
              {t('flow.rechargeDone', { amount: formatMoney(result.amount, lang) })}
            </Alert>
            <dl className="wiz__review">
              <Row label={t('flow.transactionId')} value={result.transactionId} id />
              <Row label={t('flow.msisdn')} value={result.msisdn ?? ''} id />
            </dl>
          </>
        ) : entry.status === 'failed' ? (
          <>
            <Alert tone="danger">{t(entry.errorKey ?? 'error.generic')}</Alert>
            <Button variant="ghost" onClick={() => outbox.retry(entry.id)}>
              {t('flow.retry')}
            </Button>
          </>
        ) : (
          <Alert tone="warn">{t('flow.rechargeQueued')}</Alert>
        )}
      </div>
    )
  }

  return (
    <div className="wiz__section">
      <p className="wiz__legend">{t('flow.firstRecharge')}</p>
      <p className="wiz__note">{t('flow.firstRechargeIntro')}</p>
      <div className="wiz__chips">
        {QUICK_AMOUNTS.map((amount) => (
          <button
            key={amount}
            type="button"
            className="wiz__chip"
            aria-pressed={data.rechargeAmount === String(amount)}
            onClick={() => ctx.update({ rechargeAmount: String(amount) })}
          >
            {formatMoney(amount, lang)}
          </button>
        ))}
      </div>
      <Field
        id="rechargeAmount"
        label={t('flow.amount')}
        help={t('flow.amountHelp')}
        identifier
        maxLength={4}
        value={data.rechargeAmount}
        error={error ? t(error) : undefined}
        onChange={(e) => {
          setError(null)
          ctx.update({ rechargeAmount: formatIdentifier(e.target.value) })
        }}
        {...ID_INPUT}
      />
      <div className="wiz__chips">
        <Button onClick={submit}>{t('flow.rechargeNow')}</Button>
      </div>
    </div>
  )
}
