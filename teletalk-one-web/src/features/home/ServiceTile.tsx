import { memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Icon } from '../../components/Icon'
import type { MenuItem } from './menu'

/**
 * A tile is only ever rendered for a service the session is permitted to use —
 * callers filter on capability first. There is deliberately no "locked" state:
 * showing a retailer six greyed-out channel-management functions is noise, and
 * it advertises the shape of the back office to a shared counter terminal.
 *
 * Hiding is presentation, not access control. The real guard is on the route
 * (see ModulePage) because the URL is guessable.
 *
 * Memoised — /services renders dozens of these and re-renders on every
 * keystroke of the search box.
 */
export const ServiceTile = memo(function ServiceTile({
  item,
  big = false,
  onOpen,
}: {
  item: MenuItem
  big?: boolean
  onOpen: () => void
}) {
  const { t } = useTranslation()

  return (
    <button
      type="button"
      className={`tile${big ? ' tile--big' : ''}`}
      // Category colour is data-driven so a new group only touches tokens.
      data-cat={item.group}
      onClick={onOpen}
    >
      <span className="tile__icon">
        <Icon name={item.icon} size={big ? 26 : 22} />
      </span>
      <span className="tile__label">{t(`item.${item.id}`)}</span>
    </button>
  )
})
