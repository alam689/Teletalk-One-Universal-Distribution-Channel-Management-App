import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui'
import { Icon } from '../../components/Icon'
import './stub.css'

/**
 * What a deep link to an unpermitted service renders.
 *
 * Hiding a tile is presentation; this is the access control, and it lives in
 * one component so the stub screens and the real transaction screens cannot
 * drift into enforcing it differently. It names the capability, because the
 * retailer's next action is to quote it to their zonal in-charge.
 */
export function LockedService({
  titleKey,
  capability,
}: {
  titleKey: string
  capability: string
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <div className="stub">
      <span className="stub__icon stub__icon--muted">
        <Icon name="lock" size={30} />
      </span>
      <h1 className="stub__title">{t(titleKey)}</h1>
      <p className="stub__body">{t('home.locked')}</p>
      <p className="stub__cap">
        <span>{t('stub.capability')}</span>
        <code className="identifier">{capability}</code>
      </p>
      <Button variant="ghost" onClick={() => navigate('/services')}>
        {t('nav.backToServices')}
      </Button>
    </div>
  )
}
