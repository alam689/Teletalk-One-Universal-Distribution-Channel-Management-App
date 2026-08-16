import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field, Select } from '../../components/ui'
import { EmptyState, Panel, ResourceView, StatusPill, type StatusTone } from '../../components/data'
import { Icon } from '../../components/Icon'
import { formatIdentifier, formatQuantity, formatRelativeDay, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { ASSIGNABLE_ROLES } from '../auth/roles'
import type { Role } from '../auth/authTypes'
import { getDevices, getTerritories, getUsers, queueUser } from './channelApi'
import type { DeviceState, TerritoryNode } from './channelTypes'
import './channel.css'

/* --------------------------------- users -------------------------------- */

export function UserManagePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const users = useResource('users', getUsers)

  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ posCode: '', nameBn: '', nameEn: '', role: 'sr' as Role, territory: '' })
  const [error, setError] = useState<string | null>(null)
  const [outboxId, setOutboxId] = useState<string | null>(null)

  if (!can('user.manage')) {
    return <LockedService titleKey="item.userManage" capability="user.manage" />
  }

  const submit = () => {
    if (form.posCode.length !== 8) return setError('error.posLength')
    if (!form.nameBn.trim() || !form.nameEn.trim()) return setError('error.nameRequired')
    setError(null)
    setOutboxId(queueUser(form).id)
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.userManage')}</h1>
        <p className="screen__lede">{t('user.lede')}</p>
      </header>

      {!creating && (
        <div>
          <Button onClick={() => setCreating(true)}>{t('user.new')}</Button>
        </div>
      )}

      {creating && (
        <Panel title={t('user.new')}>
          {outboxId ? (
            <OutcomePanel
              outboxId={outboxId}
              doneKey="user.created"
              onAgain={() => {
                setOutboxId(null)
                setCreating(false)
                users.reload()
              }}
            />
          ) : (
            <div className="form">
              <div className="wiz__grid">
                <Field
                  id="userPos"
                  label={t('profile.posCode')}
                  identifier
                  inputMode="numeric"
                  maxLength={8}
                  value={form.posCode}
                  onChange={(e) => {
                    setError(null)
                    setForm({ ...form, posCode: formatIdentifier(e.target.value) })
                  }}
                />
                <Field
                  id="userNameBn"
                  label={t('retailer.nameBn')}
                  lang="bn"
                  value={form.nameBn}
                  onChange={(e) => setForm({ ...form, nameBn: e.target.value })}
                />
                <Field
                  id="userNameEn"
                  label={t('retailer.nameEn')}
                  lang="en"
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                />
                <Select
                  id="userRole"
                  label={t('profile.role')}
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  options={ASSIGNABLE_ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))}
                />
                <Field
                  id="userTerritory"
                  label={t('profile.territory')}
                  value={form.territory}
                  onChange={(e) => setForm({ ...form, territory: e.target.value })}
                />
              </div>
              {/* The capability set comes from the role, never from this form:
                  the org model lives in roles.ts and stays there. */}
              <p className="wiz__note">{t('user.capabilityNote')}</p>
              {error && <Alert tone="danger">{t(error)}</Alert>}
              <div className="form__actions">
                <Button onClick={submit}>{t('user.create')}</Button>
                <Button variant="ghost" onClick={() => setCreating(false)}>
                  {t('wizard.cancel')}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      )}

      <Panel title={t('user.all')}>
        <ResourceView
          resource={users}
          skeletonRows={4}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState icon="users" title={t('user.emptyTitle')} />}
        >
          {(data) => (
            <ul className="ledger">
              {data.map((user) => (
                <li className="ledger__item" key={user.posCode}>
                  <div className="ledger__body">
                    <p className="ledger__title">{user.name[lang]}</p>
                    <p className="ledger__id">
                      <span className="identifier">{user.posCode}</span> · {t(`role.${user.role}`)}
                    </p>
                  </div>
                  <div className="ledger__right">
                    <StatusPill
                      tone={user.status === 'active' ? 'ok' : 'muted'}
                      label={t(`user.status.${user.status}`)}
                    />
                  </div>
                  <p className="ledger__meta">
                    {user.territory?.[lang] ?? t('user.noTerritory')}
                    {user.lastSignInOn &&
                      ` · ${t('user.lastSignIn', {
                        when: formatRelativeDay(user.lastSignInOn, lang, {
                          today: t('data.today'),
                          yesterday: t('data.yesterday'),
                        }),
                      })}`}
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

/* ------------------------------- territory ------------------------------ */

/**
 * The zone → territory → route hierarchy.
 *
 * A nested list rather than a map, for the reason recorded in `lib/geo.ts`.
 * What this screen is actually for is finding the gaps: a territory with no
 * owner is a territory nobody visits, and that reads far more clearly in a
 * list than as an unshaded polygon.
 */
export function TerritoryPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const territories = useResource('territories', getTerritories)

  if (!can('territory.manage')) {
    return <LockedService titleKey="item.territory" capability="territory.manage" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.territory')}</h1>
        <p className="screen__lede">{t('territory.lede')}</p>
      </header>

      <Panel title={t('territory.tree')}>
        <ResourceView resource={territories} skeletonRows={4}>
          {(data) => (
            <ul className="tree">
              {data.map((node) => (
                <TerritoryBranch key={node.code} node={node} depth={0} />
              ))}
            </ul>
          )}
        </ResourceView>
      </Panel>
    </div>
  )
}

function TerritoryBranch({ node, depth }: { node: TerritoryNode; depth: number }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang

  return (
    <li className="tree__item" style={{ paddingInlineStart: `${depth * 20}px` }}>
      <div className="tree__row">
        <span className="tree__icon" aria-hidden="true">
          <Icon name={node.kind === 'route' ? 'route' : 'map'} size={18} />
        </span>
        <span className="tree__body">
          <span className="tree__name">{node.name[lang]}</span>
          <span className="tree__meta">
            <span className="identifier">{node.code}</span> ·{' '}
            {t('territory.outlets', { count: node.outlets })}
          </span>
        </span>
        {node.ownerName ? (
          <span className="tree__owner">{node.ownerName[lang]}</span>
        ) : (
          // The finding, not an empty cell.
          <StatusPill tone="warn" label={t('territory.unassigned')} />
        )}
      </div>
      {node.children && (
        <ul className="tree">
          {node.children.map((child) => (
            <TerritoryBranch key={child.code} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

/* --------------------------------- devices ------------------------------ */

const DEVICE_TONE: Record<DeviceState, StatusTone> = {
  online: 'ok',
  stale: 'warn',
  offline: 'danger',
}

export function DeviceMonitorPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const devices = useResource('devices', getDevices)

  if (!can('device.monitor')) {
    return <LockedService titleKey="item.deviceMonitor" capability="device.monitor" />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.deviceMonitor')}</h1>
        <p className="screen__lede">{t('device.lede')}</p>
      </header>

      <Panel title={t('device.all')}>
        <ResourceView
          resource={devices}
          skeletonRows={3}
          isEmpty={(data) => data.length === 0}
          empty={<EmptyState icon="device" title={t('device.emptyTitle')} />}
        >
          {(data) => (
            <ul className="ledger">
              {data.map((device) => (
                <li className="ledger__item" key={device.deviceId}>
                  <div className="ledger__body">
                    <p className="ledger__title">{device.outletName[lang]}</p>
                    <p className="ledger__id">
                      {device.model} · <span className="identifier">{device.deviceId}</span>
                    </p>
                  </div>
                  <div className="ledger__right">
                    <StatusPill
                      tone={DEVICE_TONE[device.state]}
                      label={t(`device.state.${device.state}`)}
                    />
                    {/* App version matters: an outlet three releases behind is
                        an outlet running validation rules we have since fixed. */}
                    <span className="batch__unit identifier">{device.appVersion}</span>
                  </div>
                  <p className="ledger__meta">
                    <span className="identifier">{device.posCode}</span> ·{' '}
                    {t('device.lastSeen', {
                      when: formatRelativeDay(device.lastSeenOn, lang, {
                        today: t('data.today'),
                        yesterday: t('data.yesterday'),
                      }),
                    })}
                  </p>
                  <span className="visually-hidden">
                    {formatQuantity(data.length, lang)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ResourceView>
      </Panel>
    </div>
  )
}
