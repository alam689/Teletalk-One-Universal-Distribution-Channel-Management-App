import { env } from '../env'
import { outbox, type OutboxEntry } from '../lib/outbox'
import { sendMock as sendCounterMutation } from '../features/activation/activationMock'
import { handleOpsMutation } from '../features/ops/opsMock'

/**
 * Routes queued mutations to the right in-repo mock while `API_BASE_URL` is
 * unset.
 *
 * It lives at the top level rather than inside a feature because it is the one
 * place that has to know about all of them, and because the alternative —
 * whichever feature happens to be imported first installing the transport —
 * makes the queue's behaviour depend on the screen the retailer happened to
 * open. That is exactly the kind of order dependence that shows up once, in
 * production, in a way nobody can reproduce.
 *
 * Installed from `App.tsx` and from the test setup, before anything can flush.
 */

const OPS_PATHS = ['/requisitions', '/complaints', '/wallet/', '/stock/movements']

function route(entry: OutboxEntry): Promise<unknown> {
  if (OPS_PATHS.some((path) => entry.path.startsWith(path))) return handleOpsMutation(entry)
  return sendCounterMutation(entry)
}

export function installMockTransport(): void {
  if (!env.useMockApi) return
  outbox.setTransport(route)
}
