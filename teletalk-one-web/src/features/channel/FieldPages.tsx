import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Checkbox, Field, Select } from '../../components/ui'
import { EmptyState, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDateTime, formatIdentifier, formatQuantity, type Lang } from '../../i18n/format'
import {
  ACCEPTABLE_ACCURACY_METRES,
  captureLocation,
  formatCoordinate,
  GeoError,
  type GeoFix,
} from '../../lib/geo'
import { logger } from '../../lib/logger'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import {
  getFieldVisits,
  getGeofences,
  getPosmAudits,
  getPosmItems,
  queueFieldVisit,
  queueGeofence,
  queuePosmAudit,
} from './channelApi'
import type { PosmItem, VisitPurpose } from './channelTypes'
import './channel.css'

const PURPOSES: VisitPurpose[] = ['routine', 'stock', 'complaint', 'training', 'audit']

/* ------------------------------ location UI ----------------------------- */

/**
 * The location control, shared by the visit log and the geo-fence editor.
 *
 * It shows the accuracy figure rather than hiding it behind a tick. A fix
 * taken indoors behind a shutter can be a kilometre out, and a screen that
 * says only "location captured" turns that into evidence it is not.
 */
function LocationCapture({
  fix,
  onFix,
}: {
  fix: GeoFix | null
  onFix: (fix: GeoFix) => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const capture = () => {
    setBusy(true)
    setError(null)
    captureLocation()
      .then(onFix)
      .catch((err: unknown) => {
        setError(err instanceof GeoError ? err.key : 'error.geoUnavailable')
        logger.warn('location capture refused', { err })
      })
      .finally(() => setBusy(false))
  }

  return (
    <div className="geo">
      <div className="form__actions">
        <Button variant="ghost" busy={busy} onClick={capture}>
          {t(fix ? 'geo.recapture' : 'geo.capture')}
        </Button>
      </div>
      {fix && (
        <>
          <p className="geo__coords identifier">
            {formatCoordinate(fix.lat)}, {formatCoordinate(fix.lng)}
          </p>
          <StatusPill
            tone={fix.accuracy <= ACCEPTABLE_ACCURACY_METRES ? 'ok' : 'warn'}
            label={t('geo.accuracy', { count: Math.round(fix.accuracy) })}
          />
          {fix.accuracy > ACCEPTABLE_ACCURACY_METRES && (
            <p className="wiz__note">{t('geo.poorAccuracy')}</p>
          )}
        </>
      )}
      {error && <Alert tone="danger">{t(error)}</Alert>}
      <p className="wiz__note">{t('geo.noMapNote')}</p>
      <span className="visually-hidden">
        {fix ? formatQuantity(Math.round(fix.accuracy), lang) : ''}
      </span>
    </div>
  )
}

/* ------------------------------ field visit ----------------------------- */

export function FieldVisitPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const visits = useResource('fieldVisits', getFieldVisits)

  const [posCode, setPosCode] = useState('')
  const [purpose, setPurpose] = useState<VisitPurpose>('routine')
  const [note, setNote] = useState('')
  const [fix, setFix] = useState<GeoFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  if (!can('fieldVisit.log')) {
    return <LockedService titleKey="item.fieldVisit" capability="fieldVisit.log" />
  }

  const submit = () => {
    if (posCode.length !== 8) return setError('error.posLength')
    // A visit without a fix is a claim, not a record. It is allowed — a phone
    // with location off still has to be usable — but it is called what it is.
    setError(null)
    setOutboxId(
      queueFieldVisit({ posCode, purpose, note: note.trim() || undefined, location: fix ?? undefined })
        .id,
    )
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.fieldVisit')}</h1>
        <p className="screen__lede">{t('visit.lede')}</p>
      </header>

      <Panel title={t('visit.log')}>
        {outboxId ? (
          <OutcomePanel
            outboxId={outboxId}
            doneKey="visit.logged"
            onAgain={() => {
              setOutboxId(null)
              setPosCode('')
              setNote('')
              setFix(null)
              visits.reload()
            }}
          />
        ) : (
          <div className="form">
            <Field
              id="visitPos"
              label={t('visit.outlet')}
              help={t('visit.outletHelp')}
              identifier
              inputMode="numeric"
              maxLength={8}
              value={posCode}
              onChange={(e) => {
                setError(null)
                setPosCode(formatIdentifier(e.target.value))
              }}
            />
            <Select
              id="visitPurpose"
              label={t('visit.purpose')}
              value={purpose}
              onChange={(e) => setPurpose(e.target.value as VisitPurpose)}
              options={PURPOSES.map((p) => ({ value: p, label: t(`visit.purposeName.${p}`) }))}
            />
            <Field
              id="visitNote"
              label={t('lift.note')}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <LocationCapture fix={fix} onFix={setFix} />
            {!fix && <p className="wiz__note">{t('visit.noLocationNote')}</p>}
            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={submit}>{t('visit.submit')}</Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={t('visit.recent')}>
        <ResourceView
          resource={visits}
          skeletonRows={2}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState icon="pin" title={t('visit.emptyTitle')} />}
        >
          {(data) => (
            <ul className="ledger">
              {data.map((visit) => (
                <li className="ledger__item" key={visit.id}>
                  <div className="ledger__body">
                    <p className="ledger__title">{visit.outletName[lang]}</p>
                    <p className="ledger__id">
                      <span className="identifier">{visit.posCode}</span> ·{' '}
                      {t(`visit.purposeName.${visit.purpose}`)}
                    </p>
                  </div>
                  <div className="ledger__right">
                    {visit.distanceMetres !== undefined ? (
                      <StatusPill
                        // Distance from the registered point is what makes a
                        // logged visit checkable rather than assertable.
                        tone={visit.distanceMetres <= 150 ? 'ok' : 'warn'}
                        label={t('visit.distance', { count: visit.distanceMetres })}
                      />
                    ) : (
                      <StatusPill tone="muted" label={t('visit.noLocation')} />
                    )}
                  </div>
                  <p className="ledger__meta">{formatDateTime(visit.visitedOn, lang)}</p>
                  {visit.note && <p className="ledger__note">{visit.note}</p>}
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </Panel>
    </div>
  )
}

/* ---------------------------------- POSM -------------------------------- */

/**
 * POSM audit.
 *
 * **The photograph is recorded by name, not uploaded.** There is no
 * file-storage endpoint in the contract, and inventing one here would commit
 * Teletalk to a retention decision nobody has made — a photograph of a shop
 * front is personal data with a lifetime. The file is chosen, its name travels
 * with the audit, and STATUS.md carries the open question.
 */
export function PosmAuditPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const audits = useResource('posm', getPosmAudits)

  const [items, setItems] = useState<PosmItem[]>([])
  const [posCode, setPosCode] = useState('')
  const [present, setPresent] = useState<string[]>([])
  const [photoName, setPhotoName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    getPosmItems(controller.signal)
      .then(setItems)
      .catch((err: unknown) => logger.warn('posm items unavailable', { err }))
    return () => controller.abort()
  }, [])

  if (!can('posm.audit')) return <LockedService titleKey="item.posm" capability="posm.audit" />

  const toggle = (code: string, on: boolean) =>
    setPresent((list) => (on ? [...list, code] : list.filter((c) => c !== code)))

  const submit = () => {
    if (posCode.length !== 8) return setError('error.posLength')
    setError(null)
    setOutboxId(queuePosmAudit({ posCode, present, photoName: photoName || undefined }).id)
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.posm')}</h1>
        <p className="screen__lede">{t('posm.lede')}</p>
      </header>

      <Panel title={t('posm.newAudit')}>
        {outboxId ? (
          <OutcomePanel
            outboxId={outboxId}
            doneKey="posm.recorded"
            onAgain={() => {
              setOutboxId(null)
              setPosCode('')
              setPresent([])
              setPhotoName('')
              audits.reload()
            }}
          />
        ) : (
          <div className="form">
            <Field
              id="posmPos"
              label={t('visit.outlet')}
              identifier
              inputMode="numeric"
              maxLength={8}
              value={posCode}
              onChange={(e) => {
                setError(null)
                setPosCode(formatIdentifier(e.target.value))
              }}
            />
            <p className="wiz__legend">{t('posm.checklist')}</p>
            {items.map((item) => (
              <Checkbox
                key={item.code}
                id={`posm-${item.code}`}
                label={item.label[lang]}
                checked={present.includes(item.code)}
                onChange={(v) => toggle(item.code, v)}
              />
            ))}

            <div className="field">
              <label className="field__label" htmlFor="posmPhoto">
                {t('posm.photo')}
              </label>
              <input
                id="posmPhoto"
                className="field__input"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? '')}
              />
              <p className="field__help">{t('posm.photoHelp')}</p>
            </div>
            {photoName && <p className="wiz__note identifier">{photoName}</p>}

            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={submit}>{t('posm.submit')}</Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={t('posm.recent')}>
        <ResourceView
          resource={audits}
          skeletonRows={2}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState icon="poster" title={t('posm.emptyTitle')} />}
        >
          {(data) => (
            <ul className="ledger">
              {data.map((audit) => (
                <li className="ledger__item" key={audit.id}>
                  <div className="ledger__body">
                    <p className="ledger__title">{audit.outletName[lang]}</p>
                    <p className="ledger__id identifier">{audit.posCode}</p>
                  </div>
                  <div className="ledger__right">
                    <StatusPill
                      tone={audit.missing.length === 0 ? 'ok' : 'warn'}
                      label={t('posm.missingCount', { count: audit.missing.length })}
                    />
                  </div>
                  <p className="ledger__meta">
                    {formatDateTime(audit.auditedOn, lang)}
                    {audit.photoName && ` · ${audit.photoName}`}
                  </p>
                  {audit.missing.length > 0 && (
                    <p className="ledger__note">
                      {audit.missing
                        .map((code) => items.find((i) => i.code === code)?.label[lang] ?? code)
                        .join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </Panel>
    </div>
  )
}

/* -------------------------------- geofence ------------------------------ */

export function GeofencePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const fences = useResource('geofences', getGeofences)

  const [posCode, setPosCode] = useState('')
  const [radius, setRadius] = useState('200')
  const [fix, setFix] = useState<GeoFix | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  if (!can('geofence.manage')) {
    return <LockedService titleKey="item.geofence" capability="geofence.manage" />
  }

  const submit = () => {
    if (posCode.length !== 8) return setError('error.posLength')
    if (!fix) return setError('error.locationRequired')
    const metres = Number(formatIdentifier(radius)) || 0
    if (metres < 50 || metres > 2000) return setError('error.radiusRange')
    setError(null)
    setOutboxId(
      queueGeofence({ posCode, lat: fix.lat, lng: fix.lng, radiusMetres: metres }).id,
    )
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.geofence')}</h1>
        <p className="screen__lede">{t('fence.lede')}</p>
      </header>

      <Panel title={t('fence.set')}>
        {outboxId ? (
          <OutcomePanel
            outboxId={outboxId}
            doneKey="fence.saved"
            onAgain={() => {
              setOutboxId(null)
              setPosCode('')
              setFix(null)
              fences.reload()
            }}
          />
        ) : (
          <div className="form">
            <Field
              id="fencePos"
              label={t('visit.outlet')}
              identifier
              inputMode="numeric"
              maxLength={8}
              value={posCode}
              onChange={(e) => {
                setError(null)
                setPosCode(formatIdentifier(e.target.value))
              }}
            />
            {/* Standing at the shop is the point: the fence is set from where
                the outlet actually is, not from a coordinate typed at a desk. */}
            <p className="wiz__note">{t('fence.standHere')}</p>
            <LocationCapture fix={fix} onFix={setFix} />
            <Field
              id="fenceRadius"
              label={t('fence.radius')}
              help={t('fence.radiusHelp')}
              identifier
              inputMode="numeric"
              maxLength={4}
              value={radius}
              onChange={(e) => {
                setError(null)
                setRadius(formatIdentifier(e.target.value))
              }}
            />
            {error && <Alert tone="danger">{t(error)}</Alert>}
            <div className="form__actions">
              <Button onClick={submit}>{t('fence.save')}</Button>
            </div>
          </div>
        )}
      </Panel>

      <Panel title={t('fence.current')}>
        <ResourceView resource={fences} skeletonRows={3}>
          {(data) => (
            <ul className="ledger">
              {data.map((fence) => (
                <li className="ledger__item" key={fence.posCode}>
                  <div className="ledger__body">
                    <p className="ledger__title">{fence.outletName[lang]}</p>
                    <p className="ledger__id identifier">
                      {formatCoordinate(fence.lat)}, {formatCoordinate(fence.lng)}
                    </p>
                  </div>
                  <div className="ledger__right">
                    <StatusPill
                      tone="muted"
                      label={t('fence.metres', { count: fence.radiusMetres })}
                    />
                  </div>
                  <p className="ledger__meta">
                    <span className="identifier">{fence.posCode}</span>
                    {fence.updatedOn && ` · ${formatDateTime(fence.updatedOn, lang)}`}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </Panel>
    </div>
  )
}
