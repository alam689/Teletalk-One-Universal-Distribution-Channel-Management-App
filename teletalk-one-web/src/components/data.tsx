import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from './ui'
import { Icon, type IconName } from './Icon'
import type { Resource } from '../lib/useResource'
import './data.css'

/**
 * The read-screen kit.
 *
 * Twelve screens show a list that can be loading, empty, broken or fine. Left
 * to each screen, "broken" is the state that gets forgotten — it is the one
 * nobody sees while building against a mock that always answers. `ResourceView`
 * makes all four states unavoidable, and gives the broken one a retry, because
 * every one of these screens is reachable while the tower is down.
 */

/* ------------------------------- Panel -------------------------------- */

export function Panel({
  title,
  action,
  children,
}: {
  title?: string
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="panel">
      {(title || action) && (
        <header className="panel__head">
          {title && <h2 className="panel__title">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

/* ----------------------------- EmptyState ------------------------------ */

export function EmptyState({
  icon = 'list',
  title,
  body,
}: {
  icon?: IconName
  title: string
  body?: string
}) {
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </span>
      <p className="empty__title">{title}</p>
      {body && <p className="empty__body">{body}</p>}
    </div>
  )
}

/* ------------------------------ Skeleton ------------------------------- */

/**
 * A shaped placeholder, not a spinner. On a 2G connection the list takes long
 * enough that a spinner reads as "stuck"; rows that are already the right size
 * read as "coming", and the layout does not jump when they fill.
 */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { t } = useTranslation()
  return (
    <div className="skeleton" role="status" aria-live="polite" aria-busy="true">
      <span className="visually-hidden">{t('app.loading')}</span>
      {Array.from({ length: rows }, (_, i) => (
        <span key={i} className="skeleton__row" aria-hidden="true" />
      ))}
    </div>
  )
}

/* ----------------------------- StatusPill ------------------------------ */

export type StatusTone = 'ok' | 'warn' | 'danger' | 'muted'

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }) {
  return <span className={`pill pill--${tone}`}>{label}</span>
}

/* ---------------------------- ResourceView ----------------------------- */

interface ResourceViewProps<T> {
  resource: Resource<T>
  /** Rendered instead of `children` when the payload has nothing in it. */
  empty?: ReactNode
  isEmpty?: (data: T) => boolean
  skeletonRows?: number
  children: (data: T) => ReactNode
}

export function ResourceView<T>({
  resource,
  empty,
  isEmpty,
  skeletonRows = 3,
  children,
}: ResourceViewProps<T>) {
  const { t } = useTranslation()

  if (resource.error) {
    return (
      <div className="resource-error" role="alert">
        <p className="resource-error__text">{t(resource.error)}</p>
        <Button variant="ghost" onClick={resource.reload}>
          {t('data.retry')}
        </Button>
      </div>
    )
  }

  // Keep the last good data on screen through a reload rather than blanking
  // it — a retailer re-checking a ledger should not lose their place.
  if (resource.data === null) {
    return resource.loading ? <Skeleton rows={skeletonRows} /> : null
  }

  if (empty && isEmpty?.(resource.data)) return <>{empty}</>

  return <>{children(resource.data)}</>
}

/* ----------------------------- FilterChips ----------------------------- */

export interface FilterOption {
  value: string
  label: string
}

export function FilterChips({
  legend,
  options,
  value,
  onChange,
}: {
  legend: string
  options: FilterOption[]
  value: string
  onChange: (value: string) => void
}) {
  return (
    <div className="filters" role="group" aria-label={legend}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="filters__chip"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/* -------------------------------- Metric ------------------------------- */

export function Metric({
  label,
  value,
  hint,
  strong = false,
}: {
  label: string
  value: string
  hint?: string
  strong?: boolean
}) {
  return (
    <article className={`metric${strong ? ' metric--strong' : ''}`}>
      <p className="metric__label">{label}</p>
      <p className="metric__value">{value}</p>
      {hint && <p className="metric__hint">{hint}</p>}
    </article>
  )
}

export function MetricGrid({ children, label }: { children: ReactNode; label: string }) {
  return (
    <section className="metrics" aria-label={label}>
      {children}
    </section>
  )
}

/* ------------------------------- DataRow ------------------------------- */

/** Label left, value right. `id` renders the value Latin and monospaced. */
export function DataRow({
  label,
  value,
  id = false,
}: {
  label: string
  value: ReactNode
  id?: boolean
}) {
  return (
    <div className="datarow">
      <dt>{label}</dt>
      <dd className={id ? 'identifier' : undefined}>{value}</dd>
    </div>
  )
}
