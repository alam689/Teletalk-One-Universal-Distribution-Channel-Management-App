import { useTranslation } from 'react-i18next'
import { Panel } from '../../components/data'
import { Icon } from '../../components/Icon'
import type { Lang } from '../../i18n/format'
import { useSession } from '../auth/AuthProvider'
import './counter.css'

/**
 * Support, and deliberately not a ticket form — `complaintCreate` is that, in
 * Phase 2. This screen answers the question a retailer has at the moment
 * something is wrong: *who do I call, and what do I read them?*
 *
 * So it is three tap-to-dial rows and the identifiers the helpline will ask
 * for, rendered Latin and monospaced because they are about to be said out
 * loud over a phone.
 */
export default function SupportPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const session = useSession()

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.support')}</h1>
        <p className="screen__lede">{t('support.lede')}</p>
      </header>

      <Panel title={t('support.call')}>
        <div className="support">
          <a className="support__row" href="tel:121">
            <Icon name="help" size={20} />
            <span className="support__label">{t('support.helpline')}</span>
            <span className="support__value identifier">121</span>
          </a>
          <a className="support__row" href="tel:01500121121">
            <Icon name="store" size={20} />
            <span className="support__label">{t('support.channelDesk')}</span>
            <span className="support__value identifier">01500121121</span>
          </a>
          <a className="support__row" href="mailto:sd.support@teletalk.com.bd">
            <Icon name="list" size={20} />
            <span className="support__label">{t('support.email')}</span>
            <span className="support__value">sd.support@teletalk.com.bd</span>
          </a>
        </div>
      </Panel>

      <Panel title={t('support.quote')}>
        <p className="screen__lede">{t('support.quoteHelp')}</p>
        <div className="support">
          <div className="support__row">
            <span className="support__label">{t('profile.posCode')}</span>
            <span className="support__value identifier">{session.posCode}</span>
          </div>
          <div className="support__row">
            <span className="support__label">{t('profile.zone')}</span>
            <span className="support__value">{session.zone[lang]}</span>
          </div>
          <div className="support__row">
            <span className="support__label">{t('profile.territory')}</span>
            <span className="support__value">{session.territory[lang]}</span>
          </div>
          <div className="support__row">
            <span className="support__label">{t('profile.msisdn')}</span>
            <span className="support__value identifier">{session.msisdn}</span>
          </div>
        </div>
      </Panel>
    </div>
  )
}
