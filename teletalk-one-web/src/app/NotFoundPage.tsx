import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

export default function NotFoundPage() {
  const { t } = useTranslation()
  return (
    <div className="notfound">
      <div className="notfound__card">
        <p className="notfound__code identifier">404</p>
        <h1 className="notfound__title">{t('notFound.title')}</h1>
        <p className="notfound__body">{t('notFound.body')}</p>
        <Link className="btn btn--primary" to="/">
          {t('nav.backToHome')}
        </Link>
      </div>
    </div>
  )
}
