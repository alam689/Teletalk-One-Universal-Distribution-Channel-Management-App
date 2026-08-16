import { useTranslation } from 'react-i18next'
import { Alert } from '../../components/ui'
import { EmptyState, Metric, MetricGrid, Panel, ResourceView } from '../../components/data'
import { formatDate, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getStock } from './counterApi'
import type { StockType } from './counterTypes'
import './counter.css'

const CONFIG = {
  sim: { capability: 'stock.sim', titleKey: 'item.simStock' },
  product: { capability: 'stock.product', titleKey: 'item.productStock' },
} as const

/**
 * Stock on hand, SIM or product, one component and a type.
 *
 * For SIM the serial range is the point of the screen: the retailer's real
 * question is not "how many do I have" but "does the shelf match the system",
 * and that is answered by reading the first and last serial off the box.
 * Product stock has no serials — a router carton is a carton — so the row
 * simply omits the range rather than showing an empty one.
 */
export default function StockPage({ type }: { type: StockType }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const { capability, titleKey } = CONFIG[type]

  const stock = useResource(`stock:${type}`, (signal) => getStock(type, signal))

  if (!can(capability)) return <LockedService titleKey={titleKey} capability={capability} />

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t(titleKey)}</h1>
        <p className="screen__lede">{t(type === 'sim' ? 'stock.lede' : 'stock.ledeProduct')}</p>
      </header>

      <ResourceView
        resource={stock}
        skeletonRows={4}
        isEmpty={(data) => data.batches.length === 0}
        empty={<EmptyState icon="boxes" title={t('stock.emptyTitle')} body={t('stock.emptyBody')} />}
      >
        {(data) => (
          <>
            <MetricGrid label={t('home.summary')}>
              <Metric
                strong
                label={t(type === 'sim' ? 'stock.total' : 'stock.totalProduct')}
                value={formatQuantity(data.total, lang)}
                hint={t('stock.totalHint', { count: data.lowThreshold })}
              />
              <Metric
                label={t('stock.batches')}
                value={formatQuantity(data.batches.length, lang)}
              />
            </MetricGrid>

            {data.total <= data.lowThreshold && (
              <Alert tone="warn">{t('stock.lowWarning', { count: data.lowThreshold })}</Alert>
            )}

            <Panel title={t('stock.byBatch')}>
              {data.batches.map((batch) => (
                <div className="batch" key={batch.productCode}>
                  <div>
                    <p className="batch__name">{batch.productName[lang]}</p>
                    <p className="batch__range">
                      {t('stock.received', { date: formatDate(batch.receivedOn, lang) })}
                    </p>
                  </div>
                  <p className="batch__count">
                    {formatQuantity(batch.count, lang)}
                    <span className="batch__unit">{t('home.stockUnit')}</span>
                  </p>
                  {/* Serials are identifiers: Latin and monospaced in both
                      locales, because they are read off a physical box. */}
                  {batch.firstSerial && batch.lastSerial && (
                    <p className="batch__range">
                      <span className="identifier">{batch.firstSerial}</span>
                      {' — '}
                      <span className="identifier">{batch.lastSerial}</span>
                    </p>
                  )}
                </div>
              ))}
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}
