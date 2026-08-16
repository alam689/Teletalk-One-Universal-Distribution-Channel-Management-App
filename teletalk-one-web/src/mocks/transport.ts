import { env } from '../env'
import { outbox, type OutboxEntry } from '../lib/outbox'
import { sendMock as sendCounterMutation } from '../features/activation/activationMock'
import { handleLiftingMutation } from '../features/lifting/liftingMock'
import { handleOpsMutation } from '../features/ops/opsMock'
import { handleChannelMutation } from '../features/channel/channelMock'

/**
 * Routes queued mutations to the right in-repo mock while
 * `VITE_API_BASE_URL` is unset.
 *
 * It lives at the top level rather than inside a feature because it is the one
 * place that has to know about all of them, and because the alternative —
 * whichever feature happens to be imported first installing the transport —
 * makes the queue's behaviour depend on the route the retailer happened to
 * open. That is exactly the kind of order dependence that shows up once, in
 * production, in a way nobody can reproduce.
 *
 * Installed from `main.tsx` and from the test setup, before anything can flush.
 */

const OPS_PATHS = ['/requisitions', '/complaints', '/wallet/', '/stock/movements', '/stock/reconcile']
const CHANNEL_PATHS = ['/retailers', '/users', '/field-visits', '/posm', '/geofences']

function route(entry: OutboxEntry): Promise<unknown> {
  if (entry.path.startsWith('/lifting') || entry.path.startsWith('/sr/')) {
    return handleLiftingMutation(entry)
  }
  if (OPS_PATHS.some((path) => entry.path.startsWith(path))) return handleOpsMutation(entry)
  if (CHANNEL_PATHS.some((path) => entry.path.startsWith(path))) {
    return handleChannelMutation(entry)
  }
  return sendCounterMutation(entry)
}

export function installMockTransport(): void {
  if (!env.useMockApi) return
  outbox.setTransport(route)
}
