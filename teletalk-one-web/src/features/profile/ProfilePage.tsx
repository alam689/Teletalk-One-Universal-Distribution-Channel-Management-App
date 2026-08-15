import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { formatQuantity, maskMsisdn, type Lang } from '../../i18n/format'
import { useAuth, useSession } from '../auth/AuthProvider'
import { ALL_ITEMS } from '../home/menu'
import './profile.css'

export default function ProfilePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const { can } = useAuth()
  const navigate = useNavigate()

  const permitted = ALL_ITEMS.filter((i) => can(i.capability))

  const rows: Array<[string, string, boolean?]> = [
    [t('profile.outlet'), session.name[lang]],
    [t('profile.owner'), session.ownerName[lang]],
    [t('profile.posCode'), `BD ${session.posCode}`, true],
    [t('profile.msisdn'), maskMsisdn(session.msisdn), true],
    [t('profile.role'), t(`role.${session.role}`)],
    [t('profile.zone'), session.zone[lang]],
    [t('profile.territory'), session.territory[lang]],
    [t('profile.address'), session.outletAddress[lang]],
    [t('profile.enlisted'), formatDate(session.enlistedOn, lang)],
  ]

  return (
    <div className="profile">
      <header className="profile__head">
        <span className="profile__avatar" aria-hidden="true">
          {session.name[lang].trim().charAt(0)}
        </span>
        <div className="profile__id">
          <h1 className="profile__title">{session.name[lang]}</h1>
          <p className="profile__sub">
            <span className="rolebadge">{t(`role.${session.role}`)}</span>
            {/* Tier only exists for outlets; officers and HQ roles have none. */}
            {session.tier && (
              <span className={`tierbadge tierbadge--${session.tier}`}>
                {t(`tier.${session.tier}`)}
              </span>
            )}
            <span className="identifier">BD {session.posCode}</span>
          </p>
        </div>
      </header>

      <section className="card">
        <h2 className="card__title">{t('profile.title')}</h2>
        <dl className="deflist">
          {rows.map(([label, value, isId]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd className={isId ? 'identifier' : undefined}>{value}</dd>
            </div>
          ))}
        </dl>
        <p className="card__note">{t('profile.editNote')}</p>
      </section>

      <section className="card">
        <h2 className="card__title">{t('profile.security')}</h2>
        <dl className="deflist">
          <div>
            <dt>{t('profile.passwordUpdated')}</dt>
            <dd>{formatDate(session.passwordUpdatedOn, lang)}</dd>
          </div>
        </dl>
        <Alert tone={session.deviceTrusted ? 'ok' : 'warn'}>
          {session.deviceTrusted ? t('profile.deviceTrusted') : t('profile.deviceNotTrusted')}
        </Alert>
        <div className="card__actions">
          <Button variant="ghost" onClick={() => navigate('/profile/password')}>
            <Icon name="key" size={18} />
            {t('nav.changePassword')}
          </Button>
        </div>
      </section>

      <section className="card">
        <h2 className="card__title">{t('profile.capabilities')}</h2>
        <p className="card__note">{t('profile.capabilityCount', { count: permitted.length })}</p>
        <ul className="capchips">
          {permitted.map((i) => (
            <li key={i.id}>{t(`item.${i.id}`)}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}

/** Dates are quantities — Bengali digits in bn, Latin in en. */
function formatDate(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dd = formatQuantity(d, lang, { minimumIntegerDigits: 2 })
  const mm = formatQuantity(m, lang, { minimumIntegerDigits: 2 })
  const yyyy = formatQuantity(y, lang, { useGrouping: false })
  return `${dd}-${mm}-${yyyy}`
}
