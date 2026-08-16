import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Button, Field } from '../../components/ui'
import { DataRow, EmptyState, Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatIdentifier, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { maskNid } from '../activation/esafValidation'
import { searchCustomers } from './counterApi'
import type { CustomerRecord, CustomerStatus } from './counterTypes'
import './counter.css'

const STATUS_TONE: Record<CustomerStatus, 'ok' | 'danger' | 'muted'> = {
  active: 'ok',
  barred: 'danger',
  inactive: 'muted',
}

/**
 * Subscriber lookup by full MSISDN or full NID.
 *
 * Two deliberate constraints, both of which look like missing features until
 * you consider what the screen is:
 *
 *  - **Exact match only.** A prefix search over a subscriber base, on a device
 *    at a shop counter, is a data-protection incident with a UI. The counter
 *    always has the whole number in front of it.
 *  - **The NID is masked in the result**, the same as everywhere else. The
 *    retailer is confirming an identity, not collecting one.
 */
export default function CustomerSearchPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')

  // Empty key → no request. The screen opens quiet rather than fetching
  // everything and then filtering, which is the same privacy point again.
  const results = useResource(query, (signal) =>
    query ? searchCustomers(query, signal) : Promise.resolve([] as CustomerRecord[]),
  )

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setQuery(formatIdentifier(input))
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.customerSearch')}</h1>
        <p className="screen__lede">{t('search.lede')}</p>
      </header>

      <Panel>
        <form className="searchbar" onSubmit={submit}>
          <Field
            id="customerQuery"
            label={t('search.label')}
            help={t('search.help')}
            identifier
            inputMode="numeric"
            autoComplete="off"
            maxLength={17}
            value={input}
            onChange={(e) => setInput(formatIdentifier(e.target.value))}
          />
          <Button type="submit" busy={Boolean(query) && results.loading}>
            {t('search.submit')}
          </Button>
        </form>
      </Panel>

      {query && (
        <Panel title={t('search.results')}>
          <ResourceView
            resource={results}
            skeletonRows={1}
            isEmpty={(data) => data.length === 0}
            empty={
              <EmptyState
                icon="search"
                title={t('search.noneTitle')}
                body={t('search.noneBody')}
              />
            }
          >
            {(data) =>
              data.map((customer) => (
                <div className="customer" key={customer.msisdn}>
                  <div className="customer__head">
                    <p className="customer__name">{customer.name[lang]}</p>
                    <StatusPill
                      tone={STATUS_TONE[customer.status]}
                      label={t(`search.status.${customer.status}`)}
                    />
                  </div>
                  <dl className="datalist">
                    <DataRow label={t('flow.msisdn')} value={customer.msisdn} id />
                    <DataRow label={t('esaf.nid')} value={maskNid(customer.nid)} id />
                    <DataRow label={t('flow.plan')} value={customer.productName[lang]} />
                    <DataRow
                      label={t('search.activatedOn')}
                      value={formatDate(customer.activatedOn, lang)}
                    />
                  </dl>
                </div>
              ))
            }
          </ResourceView>
        </Panel>
      )}
    </div>
  )
}
