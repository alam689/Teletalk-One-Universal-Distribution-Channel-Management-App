import { useTranslation } from 'react-i18next'
import { EmptyState, Panel, ResourceView } from '../../components/data'
import { formatMoney, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getOffers } from './counterApi'
import './counter.css'

/**
 * Offers the retailer quotes across the counter.
 *
 * The dial code is an identifier — the customer types it into their own
 * handset — so it stays Latin and monospaced in both locales, exactly like an
 * MSISDN. Everything else on the card is prose and localises.
 */
export default function OffersPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const offers = useResource('offers', getOffers)

  if (!can('offer.view')) return <LockedService titleKey="item.offers" capability="offer.view" />

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.offers')}</h1>
        <p className="screen__lede">{t('offer.lede')}</p>
      </header>

      <ResourceView
        resource={offers}
        skeletonRows={3}
        isEmpty={(data) => data.length === 0}
        empty={<EmptyState icon="gift" title={t('offer.emptyTitle')} />}
      >
        {(data) => (
          <Panel title={t('offer.available')}>
            <ul className="ledger">
              {data.map((offer) => (
                <li className="ledger__item" key={offer.id}>
                  <div className="ledger__body">
                    <p className="ledger__title">{offer.name[lang]}</p>
                    <p className="ledger__id">{offer.body[lang]}</p>
                  </div>
                  <div className="ledger__right">
                    {offer.price !== undefined && (
                      <p className="ledger__amount">{formatMoney(offer.price, lang)}</p>
                    )}
                    {offer.validity && (
                      <span className="batch__unit">{offer.validity[lang]}</span>
                    )}
                  </div>
                  {offer.code && (
                    <p className="ledger__meta">
                      {t('offer.dial')} <span className="identifier">{offer.code}</span>
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </Panel>
        )}
      </ResourceView>
    </div>
  )
}
