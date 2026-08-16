import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field } from '../../components/ui'
import {
  DataRow,
  EmptyState,
  Metric,
  MetricGrid,
  Panel,
  ResourceView,
  StatusPill,
} from '../../components/data'
import {
  formatDate,
  formatIdentifier,
  formatMoney,
  formatRelativeDay,
  type Lang,
} from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { maskNid } from '../activation/esafValidation'
import { getCustomerProfile } from './opsApi'
import type { CustomerProfile } from './opsTypes'
import './ops.css'

/**
 * The full subscriber view.
 *
 * Two things it deliberately keeps from the lighter lookup screen: **exact
 * match only**, and **the NID masked**. Adding depth to a view is not a reason
 * to relax either — a richer screen leaking a citizen's identity number is a
 * worse incident than a thinner one doing it.
 *
 * The SIM list is the part that is genuinely new: every SIM on the NID, which
 * is what the 15-SIM ceiling is counted from and what a customer arguing about
 * it needs to see.
 */
export default function Customer360Page() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  const profile = useResource(`customer360:${query}`, (signal) =>
    query ? getCustomerProfile(query, signal) : Promise.resolve(null as CustomerProfile | null),
  )

  if (!can('customer.view360')) {
    return <LockedService titleKey="item.customer360" capability="customer.view360" />
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setQuery(formatIdentifier(input))
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.customer360')}</h1>
        <p className="screen__lede">{t('c360.lede')}</p>
      </header>

      <Panel>
        <form className="searchbar" onSubmit={submit}>
          <Field
            id="c360Msisdn"
            label={t('flow.msisdn')}
            help={t('c360.help')}
            identifier
            inputMode="numeric"
            autoComplete="off"
            maxLength={11}
            value={input}
            onChange={(e) => setInput(formatIdentifier(e.target.value))}
          />
          <Button type="submit" busy={Boolean(query) && profile.loading}>
            {t('search.submit')}
          </Button>
        </form>
      </Panel>

      {query && (
        <ResourceView
          resource={profile}
          skeletonRows={4}
          isEmpty={(data) => data === null}
          empty={<EmptyState icon="search" title={t('search.noneTitle')} />}
        >
          {(data) =>
            data && (
              <>
                <MetricGrid label={t('home.summary')}>
                  <Metric strong label={t('c360.balance')} value={formatMoney(data.balance, lang)} />
                  <Metric
                    label={t('c360.spend30')}
                    value={formatMoney(data.rechargeLast30Days, lang)}
                    hint={
                      data.lastRechargeOn
                        ? t('c360.lastRecharge', {
                            when: formatRelativeDay(data.lastRechargeOn, lang, {
                              today: t('data.today'),
                              yesterday: t('data.yesterday'),
                            }),
                          })
                        : undefined
                    }
                  />
                </MetricGrid>

                <Panel title={data.name[lang]}>
                  <dl className="datalist">
                    <DataRow label={t('flow.msisdn')} value={data.msisdn} id />
                    {/* Masked here exactly as in the lighter lookup. */}
                    <DataRow label={t('esaf.nid')} value={maskNid(data.nid)} id />
                    <DataRow label={t('flow.plan')} value={data.planName[lang]} />
                  </dl>
                </Panel>

                <Panel title={t('c360.sims', { count: data.sims.length })}>
                  <ul className="ledger">
                    {data.sims.map((sim) => (
                      <li className="ledger__item" key={sim.msisdn}>
                        <div className="ledger__body">
                          <p className="ledger__title identifier">{sim.msisdn}</p>
                          <p className="ledger__id">{sim.productName[lang]}</p>
                        </div>
                        <div className="ledger__right">
                          <StatusPill
                            tone={sim.status === 'active' ? 'ok' : 'muted'}
                            label={t(`search.status.${sim.status}`)}
                          />
                        </div>
                        <p className="ledger__meta">
                          {t('search.activatedOn')} {formatDate(sim.activatedOn, lang)}
                        </p>
                      </li>
                    ))}
                  </ul>
                </Panel>

                <Panel title={t('c360.recent')}>
                  <ul className="ledger">
                    {data.recentTransactions.map((entry) => (
                      <li className="ledger__item" key={entry.id}>
                        <div className="ledger__body">
                          <p className="ledger__title">{t(`flow.kind.${entry.kind}`)}</p>
                          <p className="ledger__id identifier">{entry.id}</p>
                        </div>
                        <div className="ledger__right">
                          {entry.amount !== undefined && (
                            <p className="ledger__amount">{formatMoney(entry.amount, lang)}</p>
                          )}
                        </div>
                        <p className="ledger__meta">{formatDate(entry.at, lang)}</p>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </>
            )
          }
        </ResourceView>
      )}
    </div>
  )
}
