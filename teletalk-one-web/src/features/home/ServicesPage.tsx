import { useDeferredValue, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Field } from '../../components/ui'
import { useAuth } from '../auth/AuthProvider'
import { ServiceTile } from './ServiceTile'
import { MENU } from './menu'
import './home.css'

export default function ServicesPage() {
  const { t } = useTranslation()
  const { can } = useAuth()
  const navigate = useNavigate()

  // Query lives in the URL so a search is shareable and survives back/forward.
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(() => params.get('q') ?? '')
  const deferred = useDeferredValue(query)

  const groups = useMemo(() => {
    const q = deferred.trim().toLowerCase()
    // Capability first, then search. A service the session cannot use never
    // appears in the catalogue at all — not even greyed out.
    return MENU.map((g) => ({
      ...g,
      items: g.items.filter(
        (i) => can(i.capability) && (!q || t(`item.${i.id}`).toLowerCase().includes(q)),
      ),
    })).filter((g) => g.items.length > 0)
  }, [deferred, t, can])

  const matches = groups.reduce((n, g) => n + g.items.length, 0)

  const onQuery = (value: string) => {
    setQuery(value)
    const next = new URLSearchParams(params)
    if (value.trim()) next.set('q', value)
    else next.delete('q')
    setParams(next, { replace: true })
  }

  return (
    <div className="home">
      <section className="home__section">
        <div className="home__section-head">
          <h1 className="home__title">{t('nav.services')}</h1>
          <Field
            id="serviceSearch"
            label={t('home.searchPlaceholder')}
            className="home__search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            type="search"
            autoComplete="off"
            enterKeyHint="search"
          />
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {t('home.resultCount', { count: matches })}
        </p>

        {matches === 0 ? (
          <p className="home__empty">{t('home.noMatch', { query: deferred.trim() })}</p>
        ) : (
          groups.map((group) => (
            <section key={group.id} className="home__group">
              <h2 className="home__group-title">{t(`group.${group.id}`)}</h2>
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
          ))
        )}
      </section>
    </div>
  )
}
