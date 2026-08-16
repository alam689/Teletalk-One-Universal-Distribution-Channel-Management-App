import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth, useSession } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { Wizard } from '../wizard/Wizard'
import { useWizard } from '../wizard/useWizard'
import { buildFlow } from './flows'
import { findFlowSpec, type FlowSpec } from './flowSpec'

/**
 * The route surface for a counter transaction.
 *
 * Two responsibilities and no more: re-check the capability on the deep link
 * (the URL is guessable, and a tile being hidden is not access control), and
 * hand the flow's spec to the engine.
 */
export default function FlowPage({ flowId }: { flowId: string }) {
  const spec = findFlowSpec(flowId)
  const { can } = useAuth()

  if (!spec) return <Navigate to="/404" replace />
  if (!can(spec.capability)) {
    return <LockedService titleKey={`item.${spec.id}`} capability={spec.capability} />
  }
  return <FlowRunner spec={spec} />
}

function FlowRunner({ spec }: { spec: FlowSpec }) {
  const session = useSession()
  const navigate = useNavigate()

  // Rebuilt only when the outlet changes. The engine holds the step list by
  // identity, so an unstable config would reset the wizard on every render.
  const config = useMemo(() => buildFlow(spec, { posCode: session.posCode }), [spec, session.posCode])
  const state = useWizard(config)

  return <Wizard state={state} titleKey={config.titleKey} onExit={() => navigate('/services')} />
}
