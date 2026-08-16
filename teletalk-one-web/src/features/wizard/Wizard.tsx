import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Stepper } from '../../components/ui'
import type { WizardState } from './types'
import './wizard.css'

interface WizardProps<TData extends object> {
  state: WizardState<TData>
  /** i18n key for the flow's own name — stable across steps. */
  titleKey: string
  /** Where the exit button goes once leaving is allowed. */
  onExit: () => void
}

/**
 * Chrome around the engine: rail, headings, footer, and the one dialog that
 * asks before throwing away a half-entered customer.
 *
 * The step heading is re-focused on every step change. Without it a screen
 * reader user completing a six-step activation is returned to the top of the
 * document each time and has to travel back down through the rail. It is an h2
 * under the flow's own h1 so that the announcement names the step — "customer
 * identity" — and not the flow, which has not changed.
 */
export function Wizard<TData extends object>({ state, titleKey, onExit }: WizardProps<TData>) {
  const { t } = useTranslation()
  const [confirming, setConfirming] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const stepId = state.step.id

  useEffect(() => {
    headingRef.current?.focus()
  }, [stepId])

  const attemptExit = () => {
    if (state.leavePolicy === 'blocked') return
    if (state.leavePolicy === 'confirm') {
      setConfirming(true)
      return
    }
    onExit()
  }

  const discardAndExit = () => {
    state.abandon()
    setConfirming(false)
    onExit()
  }

  const labels = state.steps.map((s) => t(s.labelKey))

  return (
    <section className="wiz" aria-busy={state.busy || undefined}>
      {/* Two columns from 900px up: the rail carries orientation — where you
          are and how far there is to go — and the main column carries the one
          thing being asked for. Below that they stack, and the rail's stepper
          lies down horizontally. */}
      <aside className="wiz__rail">
        <header className="wiz__head">
          <h1 className="wiz__title">{t(titleKey)}</h1>
          <p className="wiz__count">
            {t('wizard.stepOf', { current: state.index + 1, total: state.steps.length })}
          </p>
        </header>
        <Stepper steps={labels} current={state.index} srLabel={t('wizard.progress')} />
      </aside>

      <div className="wiz__main">
        <h2 className="wiz__step" tabIndex={-1} ref={headingRef}>
          {t(state.step.labelKey)}
        </h2>

        {state.resumed && !state.step.terminal && (
          <div className="wiz__resumed" role="status">
            {t('wizard.resumed')}
          </div>
        )}

        <div className="wiz__body">{state.step.render(state.context)}</div>

        {state.commitError && <Alert tone="danger">{t(state.commitError)}</Alert>}

        {state.step.terminal ? (
          <footer className="wiz__foot">
            <Button onClick={state.abandon}>{t('wizard.startAnother')}</Button>
            <Button variant="ghost" onClick={onExit}>
              {t('wizard.finish')}
            </Button>
          </footer>
        ) : (
          <footer className="wiz__foot">
            <Button onClick={state.next} busy={state.busy}>
              {t(state.step.nextLabelKey ?? 'wizard.next')}
            </Button>
            {state.index > 0 && state.leavePolicy !== 'blocked' && (
              <Button variant="ghost" onClick={state.back} disabled={state.busy}>
                {t('wizard.back')}
              </Button>
            )}
            {state.leavePolicy !== 'blocked' && (
              <Button variant="link" onClick={attemptExit} disabled={state.busy}>
                {t('wizard.cancel')}
              </Button>
            )}
          </footer>
        )}
      </div>

      {confirming && (
        <div className="wiz__confirm" role="alertdialog" aria-labelledby="wiz-confirm-title">
          <h2 className="wiz__confirmTitle" id="wiz-confirm-title">
            {t('wizard.abandonTitle')}
          </h2>
          <p className="wiz__confirmBody">{t('wizard.abandonBody')}</p>
          <div className="wiz__confirmActions">
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              {t('wizard.abandonKeep')}
            </Button>
            <Button onClick={discardAndExit}>{t('wizard.abandonDiscard')}</Button>
          </div>
        </div>
      )}
    </section>
  )
}
