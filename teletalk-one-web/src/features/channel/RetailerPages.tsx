import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Checkbox, Field } from '../../components/ui'
import {
  EmptyState,
  FilterChips,
  Metric,
  MetricGrid,
  Panel,
  ResourceView,
  StatusPill,
  type StatusTone,
} from '../../components/data'
import { formatDate, formatIdentifier, formatQuantity, formatRelativeDay, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { nameBnError, nameEnError, nidError, msisdnError } from '../activation/esafValidation'
import { getProvisions, getRetailers, queueProvision, queueRetailerOnboard } from './channelApi'
import type { OutletStatus, RetailerProvision } from './channelTypes'
import './channel.css'

const TONE: Record<OutletStatus, StatusTone> = {
  active: 'ok',
  suspended: 'danger',
  pending: 'warn',
}

/* ------------------------------- manage --------------------------------- */

export function RetailerManagePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const [filter, setFilter] = useState<'all' | OutletStatus>('all')
  const retailers = useResource('retailers', getRetailers)

  if (!can('retailer.manage')) {
    return <LockedService titleKey="item.retailerManage" capability="retailer.manage" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.retailerManage')}</h1>
        <p className="screen__lede">{t('retailer.lede')}</p>
      </header>

      <FilterChips
        legend={t('ledger.filterLegend')}
        value={filter}
        onChange={(v) => setFilter(v as 'all' | OutletStatus)}
        options={[
          { value: 'all', label: t('ledger.filterAll') },
          { value: 'active', label: t('retailer.status.active') },
          { value: 'pending', label: t('retailer.status.pending') },
          { value: 'suspended', label: t('retailer.status.suspended') },
        ]}
      />

      <ResourceView
        resource={retailers}
        skeletonRows={4}
        isEmpty={(data) => data.filter((r) => filter === 'all' || r.status === filter).length === 0}
        empty={<EmptyState icon="store" title={t('retailer.emptyTitle')} />}
      >
        {(data) => {
          const rows = data.filter((r) => filter === 'all' || r.status === filter)
          return (
            <>
              <MetricGrid label={t('home.summary')}>
                <Metric
                  strong
                  label={t('retailer.total')}
                  value={formatQuantity(data.length, lang)}
                />
                <Metric
                  label={t('retailer.status.pending')}
                  value={formatQuantity(data.filter((r) => r.status === 'pending').length, lang)}
                  hint={t('retailer.pendingHint')}
                />
              </MetricGrid>

              <Panel title={t('retailer.outlets')}>
                <ul className="ledger">
                  {rows.map((retailer) => (
                    <li className="ledger__item" key={retailer.posCode}>
                      <div className="ledger__body">
                        <p className="ledger__title">{retailer.name[lang]}</p>
                        <p className="ledger__id">
                          <span className="identifier">{retailer.posCode}</span> ·{' '}
                          {retailer.ownerName[lang]}
                        </p>
                      </div>
                      <div className="ledger__right">
                        <StatusPill
                          tone={TONE[retailer.status]}
                          label={t(`retailer.status.${retailer.status}`)}
                        />
                        {retailer.tier && (
                          <span className="batch__unit">{t(`tier.${retailer.tier}`)}</span>
                        )}
                      </div>
                      <p className="ledger__meta">
                        {retailer.territory[lang]} ·{' '}
                        {t('retailer.stock', { count: retailer.simStock })}
                        {retailer.lastActiveOn &&
                          ` · ${t('retailer.lastActive', {
                            when: formatRelativeDay(retailer.lastActiveOn, lang, {
                              today: t('data.today'),
                              yesterday: t('data.yesterday'),
                            }),
                          })}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </>
          )
        }}
      </ResourceView>
    </div>
  )
}

/* ------------------------------- onboard -------------------------------- */

/**
 * Enlisting an outlet.
 *
 * It reuses the e-SAF's name and identity validators rather than inventing
 * softer ones: a retailer record is a KYC record, and the reasons a Bangla
 * name typed on a Latin keyboard fails at BVS do not change because the
 * person being enrolled sells SIMs rather than buying one.
 */
export function RetailerOnboardPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const [form, setForm] = useState({
    nameBn: '',
    nameEn: '',
    ownerNameBn: '',
    ownerNameEn: '',
    nid: '',
    msisdn: '',
    territory: '',
    addressLine: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  if (!can('retailer.onboard')) {
    return <LockedService titleKey="item.retailerOnboard" capability="retailer.onboard" />
  }

  const set = (patch: Partial<typeof form>) => {
    setError(null)
    setForm((f) => ({ ...f, ...patch }))
  }

  const submit = () => {
    const problem =
      nameBnError(form.nameBn, 'error.outletNameRequired') ??
      nameEnError(form.nameEn) ??
      nameBnError(form.ownerNameBn, 'error.ownerNameRequired') ??
      nidError(form.nid) ??
      msisdnError(form.msisdn) ??
      (form.territory.trim() ? null : 'error.territoryRequired') ??
      (form.addressLine.trim() ? null : 'error.addressRequired')
    if (problem) {
      setError(problem)
      return
    }
    setError(null)
    setOutboxId(queueRetailerOnboard({ ...form, ownerNameEn: form.ownerNameEn || form.nameEn }).id)
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.retailerOnboard')}</h1>
        <p className="screen__lede">{t('retailer.onboardLede')}</p>
      </header>

      <Panel>
        {outboxId ? (
          <OutcomePanel
            outboxId={outboxId}
            doneKey="retailer.onboarded"
            onAgain={() => {
              setOutboxId(null)
              setForm({
                nameBn: '',
                nameEn: '',
                ownerNameBn: '',
                ownerNameEn: '',
                nid: '',
                msisdn: '',
                territory: '',
                addressLine: '',
              })
            }}
          />
        ) : (
          <div className="form">
            <div className="wiz__grid">
              <Field
                id="outletNameBn"
                label={t('retailer.nameBn')}
                lang="bn"
                value={form.nameBn}
                onChange={(e) => set({ nameBn: e.target.value })}
              />
              <Field
                id="outletNameEn"
                label={t('retailer.nameEn')}
                lang="en"
                value={form.nameEn}
                onChange={(e) => set({ nameEn: e.target.value })}
              />
              <Field
                id="ownerNameBn"
                label={t('retailer.ownerBn')}
                lang="bn"
                value={form.ownerNameBn}
                onChange={(e) => set({ ownerNameBn: e.target.value })}
              />
              <Field
                id="ownerNameEn"
                label={t('retailer.ownerEn')}
                lang="en"
                value={form.ownerNameEn}
                onChange={(e) => set({ ownerNameEn: e.target.value })}
              />
              <Field
                id="ownerNid"
                label={t('esaf.nid')}
                identifier
                inputMode="numeric"
                maxLength={17}
                value={form.nid}
                onChange={(e) => set({ nid: formatIdentifier(e.target.value) })}
              />
              <Field
                id="outletMsisdn"
                label={t('esaf.contact')}
                identifier
                inputMode="numeric"
                maxLength={11}
                value={form.msisdn}
                onChange={(e) => set({ msisdn: formatIdentifier(e.target.value) })}
              />
              <Field
                id="outletTerritory"
                label={t('profile.territory')}
                value={form.territory}
                onChange={(e) => set({ territory: e.target.value })}
              />
            </div>
            <Field
              id="outletAddress"
              label={t('esaf.addressLine')}
              lang="bn"
              value={form.addressLine}
              onChange={(e) => set({ addressLine: e.target.value })}
            />
            {/* The gap this screen creates, stated on the screen that creates it. */}
            <Alert tone="warn">{t('retailer.pendingWarning')}</Alert>
            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={submit}>{t('retailer.enlist')}</Button>
            </div>
          </div>
        )}
      </Panel>
    </div>
  )
}

/* ------------------------------ provisioning ---------------------------- */

/**
 * BVS id, DMS access and device binding.
 *
 * An outlet enlisted but unprovisioned is on the books and unable to sell
 * anything — the single most common "the app is broken" call. This screen
 * exists to make that state visible and fixable in one place.
 */
export function RetailerProvisionPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const provisions = useResource('provisions', getProvisions)

  if (!can('retailer.provision')) {
    return <LockedService titleKey="item.retailerProvision" capability="retailer.provision" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.retailerProvision')}</h1>
        <p className="screen__lede">{t('provision.lede')}</p>
      </header>

      <ResourceView
        resource={provisions}
        skeletonRows={3}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon="check" title={t('provision.emptyTitle')} />}
      >
        {(data) =>
          data.map((row) => (
            <ProvisionCard key={row.posCode} row={row} onSettled={provisions.reload} />
          ))
        }
      </ResourceView>
    </div>
  )
}

function ProvisionCard({ row, onSettled }: { row: RetailerProvision; onSettled: () => void }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [bvsId, setBvsId] = useState(row.bvsId ?? '')
  const [bvsEnabled, setBvs] = useState(row.bvsEnabled)
  const [dmsEnabled, setDms] = useState(row.dmsEnabled)
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  const submit = () => {
    if (bvsEnabled && bvsId.trim().length < 4) {
      setError('error.bvsIdRequired')
      return
    }
    setError(null)
    setOutboxId(queueProvision({ posCode: row.posCode, bvsId, bvsEnabled, dmsEnabled }).id)
  }

  const ready = row.bvsEnabled && row.dmsEnabled && row.deviceBound

  return (
    <Panel title={row.outletName[lang]}>
      <div className="campaign__head">
        <StatusPill
          tone={ready ? 'ok' : 'warn'}
          label={t(ready ? 'provision.ready' : 'provision.incomplete')}
        />
        <span className="campaign__dates identifier">{row.posCode}</span>
      </div>

      {outboxId ? (
        <OutcomePanel outboxId={outboxId} doneKey="provision.saved" onAgain={onSettled} />
      ) : (
        <div className="form">
          <Field
            id={`bvsId-${row.posCode}`}
            label={t('provision.bvsId')}
            help={t('provision.bvsIdHelp')}
            identifier
            value={bvsId}
            onChange={(e) => {
              setError(null)
              setBvsId(e.target.value)
            }}
          />
          <Checkbox
            id={`bvs-${row.posCode}`}
            label={t('provision.bvsEnabled')}
            checked={bvsEnabled}
            onChange={(v) => {
              setError(null)
              setBvs(v)
            }}
          />
          <Checkbox
            id={`dms-${row.posCode}`}
            label={t('provision.dmsEnabled')}
            checked={dmsEnabled}
            onChange={setDms}
          />
          {/* Device binding happens on the device at first sign-in; it is
              reported here and cannot be granted from a desk. */}
          <p className="wiz__note">
            {t(row.deviceBound ? 'provision.deviceBound' : 'provision.deviceNotBound')}
          </p>
          {row.updatedOn && (
            <p className="batch__range">
              {t('provision.updatedOn', { date: formatDate(row.updatedOn, lang) })}
            </p>
          )}
          {error && <Alert tone="danger">{t(error)}</Alert>}
          <div className="form__actions">
            <Button onClick={submit}>{t('provision.save')}</Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
