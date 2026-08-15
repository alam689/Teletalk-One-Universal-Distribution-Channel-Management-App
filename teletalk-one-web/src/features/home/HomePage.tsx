import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import { formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useAuth, useSession } from '../auth/AuthProvider'
import { ServiceTile } from './ServiceTile'
import { MENU, quickActionsFor } from './menu'
import './home.css'

export default function HomePage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()
  const { can } = useAuth()
  const navigate = useNavigate()

  const quick = useMemo(() => quickActionsFor(can), [can])

  // Permitted services only, and groups that end up empty drop out. An F&A
  // officer should never scroll past a wall of SIM tiles they cannot use.
  const visibleGroups = useMemo(
    () =>
      MENU.map((g) => ({ ...g, items: g.items.filter((i) => can(i.capability)) })).filter(
        (g) => g.items.length > 0,
      ),
    [can],
  )
  const preview = visibleGroups.slice(0, 3)

  const { balance, commissionToday, simStock, pendingApprovals } = session.stats

  return (
    <div className="home">
      <section className="home__stats" aria-label={t('home.summary')}>
        {balance !== undefined && (
          <article className="stat stat--primary">
            <p className="stat__label">{t('home.balanceLabel')}</p>
            <p className="stat__value">{formatMoney(balance, lang)}</p>
          </article>
        )}
        {commissionToday !== undefined && (
          <article className="stat">
            <p className="stat__label">{t('home.commissionLabel')}</p>
            <p className="stat__value">{formatMoney(commissionToday, lang)}</p>
          </article>
        )}
        {simStock !== undefined && (
          <article className="stat">
            <p className="stat__label">{t('home.stockLabel')}</p>
            <p className="stat__value">
              {formatQuantity(simStock, lang)}
              <span className="stat__unit">{t('home.stockUnit')}</span>
            </p>
          </article>
        )}
        {pendingApprovals !== undefined && (
          <article className="stat stat--action">
            <p className="stat__label">{t('home.pendingLabel')}</p>
            <p className="stat__value">{formatQuantity(pendingApprovals, lang)}</p>
          </article>
        )}
      </section>

      <section className="home__section">
        <h2 className="home__heading">{t('home.quickActions')}</h2>
        <div className="quick">
          {quick.map((item) => (
            <ServiceTile
              key={item.id}
              item={item}
              big
              onOpen={() => navigate(`/services/${item.id}`)}
            />
          ))}
        </div>
      </section>

      <section className="home__section">
        <div className="home__section-head">
          <h2 className="home__heading">{t('home.allServices')}</h2>
          <Link className="home__seeall" to="/services">
            {t('home.seeAll')}
            <Icon name="chevron" size={16} />
          </Link>
        </div>

        {preview.map((group) => (
          <section key={group.id} className="home__group">
            <h3 className="home__group-title">{t(`group.${group.id}`)}</h3>
            <div className="tiles">
              {group.items.map((item) => (
                <ServiceTile
                  key={item.id}
                  item={item}
                  onOpen={() => navigate(`/services/${item.id}`)}
                />
              ))}
            </div>
          </section>
        ))}
      </section>
    </div>
  )
}
