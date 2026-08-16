import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth, useSession } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { Wizard } from '../wizard/Wizard'
import { useWizard } from '../wizard/useWizard'
import { buildSaleFlow } from './saleFlow'
import { findSaleSpec, type SaleSpec } from './saleSpec'

/**
 * Route surface for an over-the-counter sale. Same two jobs as `FlowPage`:
 * re-check the capability on the deep link, and hand the spec to the engine.
 */
export default function SalePage({ saleId }: { saleId: string }) {
  const spec = findSaleSpec(saleId)
  const { can } = useAuth()

  if (!spec) return <Navigate to="/404" replace />
  if (!can(spec.capability)) {
    return <LockedService titleKey={`item.${spec.id}`} capability={spec.capability} />
  }
  return <SaleRunner spec={spec} />
}

function SaleRunner({ spec }: { spec: SaleSpec }) {
  const session = useSession()
  const navigate = useNavigate()
  const config = useMemo(() => buildSaleFlow(spec, session.posCode), [spec, session.posCode])
  const state = useWizard(config)

  return <Wizard state={state} titleKey={config.titleKey} onExit={() => navigate('/services')} />
}
