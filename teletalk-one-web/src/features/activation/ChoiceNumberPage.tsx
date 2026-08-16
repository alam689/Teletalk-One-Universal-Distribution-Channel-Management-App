import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field } from '../../components/ui'
import { EmptyState, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatIdentifier, formatMoney, formatTime, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { OutcomePanel } from '../outbox/OutcomePanel'
import { queueNumberReservation, searchNumbers } from './activationApi'
import type { ChoiceNumber, NumberReservation } from './activationTypes'
import '../counter/counter.css'

function isReservation(value: unknown): value is NumberReservation {
  return typeof value === 'object' && value !== null && 'reservedUntil' in value
}

/**
 * Choosing a number from the pool.
 *
 * The interesting part is not the search — it is the **hold**. A customer
 * standing at the counter takes minutes to decide, and in that time the number
 * has to belong to nobody else. That is a lock with a clock, and the client
 * cannot arbitrate it: two counters can press reserve on the same number in
 * the same second. So the server decides and the loser is told `numberTaken`,
 * which is a real state this screen renders rather than a race it pretends
 * cannot happen.
 */
export default function ChoiceNumberPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()

  const [input, setInput] = useState('')
  const [pattern, setPattern] = useState('')
  const [outboxId, setOutboxId] = useState<string | null>(null)

  const results = useResource(`numbers:${pattern}`, (signal) =>
    pattern ? searchNumbers(pattern, signal) : Promise.resolve([] as ChoiceNumber[]),
  )

  if (!can('sim.choiceNumber')) {
    return <LockedService titleKey="item.choiceNumber" capability="sim.choiceNumber" />
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setOutboxId(null)
    setPattern(formatIdentifier(input))
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.choiceNumber')}</h1>
        <p className="screen__lede">{t('choice.lede')}</p>
      </header>

      <Panel>
        <form className="searchbar" onSubmit={submit}>
          <Field
            id="numberPattern"
            label={t('choice.pattern')}
            help={t('choice.patternHelp')}
            identifier
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
            value={input}
            onChange={(e) => setInput(formatIdentifier(e.target.value))}
          />
          <Button type="submit" busy={Boolean(pattern) && results.loading}>
            {t('search.submit')}
          </Button>
        </form>
      </Panel>

      {outboxId && (
        <Panel>
          <OutcomePanel
            outboxId={outboxId}
            doneKey="choice.reserved"
            onAgain={() => {
              setOutboxId(null)
              results.reload()
            }}
          >
            {(result) =>
              isReservation(result) ? (
                <>
                  <p className="wiz__note identifier">{result.msisdn}</p>
                  {/* The hold has an end time, and it is shown as a time rather
                      than a countdown: a counter conversation runs longer than
                      a ticking number stays believable. */}
                  <p className="wiz__note">
                    {t('choice.heldUntil', { time: formatTime(result.reservedUntil, lang) })}
                  </p>
                </>
              ) : null
            }
          </OutcomePanel>
        </Panel>
      )}

      {pattern && !outboxId && (
        <Panel title={t('choice.results')}>
          <ResourceView
            resource={results}
            skeletonRows={4}
            isEmpty={(data) => data.length === 0}
            empty={
              <EmptyState
                icon="number"
                title={t('choice.noneTitle')}
                body={t('choice.noneBody')}
              />
            }
          >
            {(data) => (
              <ul className="ledger">
                {data.map((number) => (
                  <li className="ledger__item" key={number.msisdn}>
                    <div className="ledger__body">
                      <p className="ledger__title identifier">{number.msisdn}</p>
                      <p className="ledger__id">{t(`choice.tier.${number.tier}`)}</p>
                    </div>
                    <div className="ledger__right">
                      <p className="ledger__amount">{formatMoney(number.price, lang)}</p>
                      {number.status === 'available' ? (
                        <Button
                          variant="ghost"
                          onClick={() => setOutboxId(queueNumberReservation(number.msisdn).id)}
                        >
                          {t('choice.reserve')}
                        </Button>
                      ) : (
                        <StatusPill
                          tone="muted"
                          label={t(`choice.status.${number.status}`)}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </ResourceView>
        </Panel>
      )}
    </div>
  )
}
