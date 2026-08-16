import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui'
import { EmptyState, Panel } from '../../components/data'
import { Icon } from '../../components/Icon'
import { formatRelativeDay, formatTime, type Lang } from '../../i18n/format'
import { notificationStore, useNotifications } from './notificationStore'
import type { NotificationSeverity } from './counterTypes'
import './counter.css'

const SEVERITY_ICON: Record<NotificationSeverity, 'bell' | 'shield' | 'check'> = {
  info: 'bell',
  warn: 'shield',
  action: 'check',
}

/**
 * The notification centre, and the end of the bell that did nothing.
 *
 * Unread is carried by a left border, a background and a dot — never by colour
 * alone, and never by weight alone. A counter phone in daylight loses subtle
 * differences before it loses structural ones.
 */
export default function NotificationsPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { items, unread } = useNotifications()

  const markAll = () =>
    void notificationStore.markRead(items.filter((n) => !n.read).map((n) => n.id))

  return (
    <div className="screen">
      <header className="screen__head">
        <h1 className="screen__title">{t('item.notifications')}</h1>
        <p className="screen__lede">{t('notifications.lede')}</p>
      </header>

      <Panel
        title={t('nav.unread', { count: unread })}
        action={
          unread > 0 ? (
            <Button variant="link" onClick={markAll}>
              {t('notifications.markAll')}
            </Button>
          ) : undefined
        }
      >
        {items.length === 0 ? (
          <EmptyState
            icon="bell"
            title={t('notifications.emptyTitle')}
            body={t('notifications.emptyBody')}
          />
        ) : (
          <ul className="notes">
            {items.map((item) => (
              <li
                key={item.id}
                className={`note note--${item.severity}${item.read ? '' : ' note--unread'}`}
              >
                <span className="note__icon" aria-hidden="true">
                  <Icon name={SEVERITY_ICON[item.severity]} size={18} />
                </span>
                <div className="note__body">
                  <p className="note__title">
                    {item.title[lang]}
                    {!item.read && (
                      <span className="visually-hidden"> — {t('notifications.unreadSr')}</span>
                    )}
                  </p>
                  <p className="note__text">{item.body[lang]}</p>
                  <p className="note__meta">
                    {formatRelativeDay(item.at, lang, {
                      today: t('data.today'),
                      yesterday: t('data.yesterday'),
                    })}
                    {' · '}
                    {formatTime(item.at, lang)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
