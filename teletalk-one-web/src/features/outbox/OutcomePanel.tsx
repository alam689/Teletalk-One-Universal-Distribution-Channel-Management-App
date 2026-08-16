import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button } from '../../components/ui'
import { outbox } from '../../lib/outbox'
import { useOutboxEntry } from './useOutbox'

/**
 * The three states every queued mutation ends in, in one place.
 *
 * By FE-4 there are a dozen screens whose submit button does the same thing:
 * enqueue, then show *queued* until the server confirms, *done* when it does,
 * and the server's own remedy plus a retry when it refuses. Written out at each
 * call site, the middle state is the one that gets dropped — and dropping it is
 * what turns "the tower was down" into "the app said it worked".
 */
export function OutcomePanel({
  outboxId,
  doneKey,
  onAgain,
  children,
}: {
  outboxId: string | null
  /** i18n key for the success line. */
  doneKey: string
  /** Offered after success, to run the same task again. */
  onAgain?: () => void
  /** Rendered under the success line — a receipt, usually. */
  children?: (result: unknown) => ReactNode
}) {
  const { t } = useTranslation()
  const entry = useOutboxEntry(outboxId)

  if (!entry) return null

  if (entry.status === 'failed') {
    return (
      <div className="form">
        <Alert tone="danger">{t(entry.errorKey ?? 'error.generic')}</Alert>
        <div className="form__actions">
          <Button variant="ghost" onClick={() => outbox.retry(entry.id)}>
            {t('flow.retry')}
          </Button>
        </div>
      </div>
    )
  }

  if (entry.status !== 'settled') {
    return (
      <div className="form">
        <Alert tone="warn">{t('lift.actionQueued')}</Alert>
      </div>
    )
  }

  return (
    <div className="form">
      <Alert tone="ok">{t(doneKey)}</Alert>
      {children?.(entry.result)}
      {onAgain && (
        <div className="form__actions">
          <Button onClick={onAgain}>{t('ops.again')}</Button>
        </div>
      )}
    </div>
  )
}
