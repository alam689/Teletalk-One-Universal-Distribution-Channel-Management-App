import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from './LockedService'
import { MENU } from './menu'
import './stub.css'

/**
 * Landing surface for a module that is specified but not yet built. Names its
 * roadmap phase rather than pretending to be broken, which keeps the whole
 * feature surface reviewable while Phase 1 is in flight.
 */
export default function ModulePage() {
  const { moduleId } = useParams<{ moduleId: string }>()
  const { t } = useTranslation()
  const { can } = useAuth()
  const navigate = useNavigate()

  const item = MENU.flatMap((g) => g.items).find((i) => i.id === moduleId)

  // Unknown id → 404 rather than an empty shell.
  if (!item) return <Navigate to="/404" replace />

  // Deep links must be capability-checked too; hiding a tile is not access
  // control, and the URL is guessable.
  if (!can(item.capability)) {
    return <LockedService titleKey={`item.${item.id}`} capability={item.capability} />
  }

  return (
    <div className="stub">
      <span className="stub__icon">
        <Icon name={item.icon} size={30} />
      </span>
      <h1 className="stub__title">{t(`item.${item.id}`)}</h1>
      <span className="stub__phase">{t('stub.phaseLabel', { phase: item.phase })}</span>
      <p className="stub__body">{t('stub.body', { phase: item.phase })}</p>
      <p className="stub__cap">
        <span>{t('stub.capability')}</span>
        <code className="identifier">{item.capability}</code>
      </p>
      <Button variant="ghost" onClick={() => navigate('/services')}>
        {t('nav.backToServices')}
      </Button>
    </div>
  )
}
