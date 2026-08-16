import { useTranslation } from 'react-i18next'
import { Panel, ResourceView, StatusPill } from '../../components/data'
import { formatDate, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth } from '../auth/AuthProvider'
import { LockedService } from '../home/LockedService'
import { getInventory } from './liftingApi'
import type { InventoryScope } from './liftingTypes'
import './lifting.css'

const CAPABILITY = {
  central: 'inventory.central',
  zonal: 'inventory.zonal',
} as const

/**
 * Central and zonal inventory, one component and a scope.
 *
 * `allocated` is shown next to `onHand` rather than subtracted from it,
 * because they answer different questions: what is on the shelf, and what is
 * already promised to an approved lifting request. A single "available"
 * number hides the second, and the second is what the zonal in-charge is
 * approving against.
 */
export default function InventoryPage({ scope }: { scope: InventoryScope }) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { can } = useAuth()
  const capability = CAPABILITY[scope]

  const inventory = useResource(`inventory:${scope}`, (signal) => getInventory(scope, signal))

  if (!can(capability)) {
    const id = scope === 'central' ? 'centralInventory' : 'zonalInventory'
    return <LockedService titleKey={`item.${id}`} capability={capability} />
  }

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">
          {t(scope === 'central' ? 'item.centralInventory' : 'item.zonalInventory')}
        </h1>
        <p className="screen__lede">{t('inventory.lede')}</p>
      </header>

      <ResourceView resource={inventory} skeletonRows={5}>
        {(data) => (
          <>
            <Panel title={data.location?.[lang] ?? t('inventory.stock')}>
              <ul className="inv">
                {data.lines.map((line) => {
                  const low = line.onHand - line.allocated < line.reorderLevel
                  return (
                    <li className="inv__row" key={line.productCode}>
                      <div>
                        <p className="inv__name">{line.productName[lang]}</p>
                        {low && (
                          <StatusPill tone="danger" label={t('inventory.belowReorder')} />
                        )}
                      </div>
                      <div className="inv__numbers">
                        <span className="inv__figure">
                          <span className="inv__label">{t('inventory.onHand')}</span>
                          <span className={`inv__value${low ? ' inv__value--low' : ''}`}>
                            {formatQuantity(line.onHand, lang)}
                          </span>
                        </span>
                        <span className="inv__figure">
                          <span className="inv__label">{t('inventory.allocated')}</span>
                          <span className="inv__value">
                            {formatQuantity(line.allocated, lang)}
                          </span>
                        </span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </Panel>

            <Panel title={t('inventory.movements')}>
              <ul className="inv">
                {data.movements.map((movement, index) => (
                  <li className="inv__row" key={`${movement.reference}-${index}`}>
                    <div>
                      <p className="inv__name">
                        {data.lines.find((l) => l.productCode === movement.productCode)
                          ?.productName[lang] ?? movement.productCode}
                      </p>
                      {/* The reference is what ties a movement back to a
                          challan or a GRN — an identifier, so Latin. */}
                      <p className="inv__label identifier">{movement.reference}</p>
                    </div>
                    <div className="inv__numbers">
                      <span className="inv__figure">
                        <span className="inv__label">{formatDate(movement.at, lang)}</span>
                        <span className="inv__value">
                          {movement.direction === 'in' ? '+' : '−'}
                          {formatQuantity(movement.quantity, lang)}
                        </span>
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          </>
        )}
      </ResourceView>
    </div>
  )
}
