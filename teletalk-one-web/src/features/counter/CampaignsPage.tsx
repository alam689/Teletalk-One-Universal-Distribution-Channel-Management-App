import { useTranslation } from 'react-i18next'
import { EmptyState, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getCampaigns } from './counterApi'
import type { Campaign } from './counterTypes'
import './counter.css'

/**
 * Campaigns, in two views from one endpoint.
 *
 * `campaigns` is everything visible to the outlet; `myCampaign` is the subset
 * they are actually enrolled in, with their own progress against it. Splitting
 * that into two endpoints would have the same data disagreeing with itself the
 * first time one of them was cached.
 */
export default function CampaignsPage({ ownOnly = false }: { ownOnly?: boolean }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const capability = ownOnly ? 'campaign.own' : 'campaign.view'
  const titleKey = ownOnly ? 'item.myCampaign' : 'item.campaigns'

  const campaigns = useResource('campaigns', getCampaigns)

  if (!can(capability)) return <LockedService titleKey={titleKey} capability={capability} />

  const visible = (rows: Campaign[]) => (ownOnly ? rows.filter((c) => c.enrolled) : rows)

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t(titleKey)}</h1>
        <p className="screen__lede">{t(ownOnly ? 'campaign.ownLede' : 'campaign.lede')}</p>
      </header>

      <ResourceView
        resource={campaigns}
        skeletonRows={3}
        isEmpty={(data) => visible(data).length === 0}
        empty={
          <EmptyState
            icon="megaphone"
            title={t('campaign.emptyTitle')}
            body={t(ownOnly ? 'campaign.emptyOwnBody' : 'campaign.emptyBody')}
          />
        }
      >
        {(data) => (
          <>
            {visible(data).map((campaign) => (
              <Panel key={campaign.id} title={campaign.name[lang]}>
                <div className="campaign__head">
                  <StatusPill
                    tone={campaign.enrolled ? 'ok' : 'muted'}
                    label={t(campaign.enrolled ? 'campaign.enrolled' : 'campaign.open')}
                  />
                  <span className="campaign__dates">
                    {formatDate(campaign.startsOn, lang)} — {formatDate(campaign.endsOn, lang)}
                  </span>
                </div>

                <p className="screen__lede">{campaign.body[lang]}</p>

                {campaign.progress && (
                  <div className="target">
                    <p className="target__figures">
                      {formatQuantity(campaign.progress.achieved, lang)}{' '}
                      <span className="batch__unit">
                        / {formatQuantity(campaign.progress.target, lang)}
                      </span>
                    </p>
                    <div className="target__track" aria-hidden="true">
                      <span
                        className="target__fill"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.round(
                              (campaign.progress.achieved / campaign.progress.target) * 100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <p className="batch__range">
                      {t('campaign.reward', {
                        amount: formatMoney(campaign.progress.rewardAmount, lang),
                      })}
                    </p>
                  </div>
                )}
              </Panel>
            ))}
          </>
        )}
      </ResourceView>
    </div>
  )
}
