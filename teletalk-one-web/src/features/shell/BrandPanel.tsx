import { useTranslation } from 'react-i18next'
import { applyLang } from '../../i18n'
import type { Lang } from '../../i18n/format'
import { useTheme } from '../../app/ThemeProvider'
import { BrandSpark, TeletalkMark } from '../../components/TeletalkMark'
import './brand-panel.css'

/**
 * The ten capabilities the GM (Sales & Marketing) letter of 17-06-2025 lists as
 * absent from BVS. Order follows the letter.
 */
const CAPABILITIES = [
  'mnp',
  'choiceNumber',
  'simStock',
  'requisition',
  'complaint',
  'commission',
  'userMgmt',
  'payment',
  'salesAnalytics',
  'customerInventory',
] as const

export function BrandPanel() {
  const { t } = useTranslation()

  return (
    <aside className="shell__brand">
      {/* Brand furniture, both decorative and aria-hidden. The spark sits in
          the corner and the watermark to the right of the 60ch text column, so
          neither ever composites under a string. */}
      <span className="shell__spark">
        <BrandSpark size={260} />
      </span>
      <span className="shell__watermark">
        <TeletalkMark size={340} />
      </span>

        <div className="shell__brand-top">
          <p className="shell__owner">{t('app.owner')}</p>
          <p className="shell__dept">{t('app.dept')}</p>
        </div>

      {/* Two anchors, not three: letterhead at the top, everything else as one
          bottom-set block. The panel's slack then collects in a single place
          instead of punching holes between the parts of one argument. */}
      <div className="shell__brand-body">
        <div className="shell__mark">
          <div className="shell__lockup">
            <div className="shell__lockup-text">
              <h2 className="shell__wordmark">{t('app.name')}</h2>
              <p className="shell__tagline">{t('app.tagline')}</p>
            </div>
            <span className="shell__lockup-mark">
              <TeletalkMark size={58} />
            </span>
          </div>
          <p className="shell__portal">{t('app.portal')}</p>
        </div>

        <div className="shell__pitch">
          <p className="shell__pitch-title">{t('brand.pitchTitle')}</p>
        </div>

        <section className="shell__caps">
          <h3 className="shell__caps-title">{t('brand.capsTitle')}</h3>
          <ul className="shell__points">
            {CAPABILITIES.map((key) => (
              <li key={key}>{t(`brand.caps.${key}`)}</li>
            ))}
          </ul>
        </section>
      </div>
    </aside>
  )
}

/** Language and theme toggles for the signed-out shell. */
export function ShellBar() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const nextLang: Lang = lang === 'bn' ? 'en' : 'bn'
  const { theme, cycle } = useTheme()

  return (
    <div className="shell__bar">
      <button
        type="button"
        className="chip"
        onClick={() => applyLang(nextLang)}
        lang={nextLang}
        aria-label={`${t('lang.label')}: ${t('lang.switchTo')}`}
      >
        {t('lang.switchTo')}
      </button>
      <button type="button" className="chip" onClick={cycle}>
        {theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
      </button>
    </div>
  )
}
