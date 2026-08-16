import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { I18nManager } from 'react-native'
import bn from './locales/bn.json'
import en from './locales/en.json'
import { formatMoney, formatQuantity, type Lang } from './format'
import { prefs, PrefKeys } from '../lib/storage'

/**
 * Bangla is the source locale, English is the translation — the same way round
 * as the web portal, and for the same reason: the strings were written by
 * people who do this work, in the language they do it in.
 *
 * Unlike the portal, both locales are bundled. The portal fetches English on
 * demand because it saves 12 kB on a first page load over a field connection.
 * An app binary is downloaded once, from a store, on wifi; splitting it would
 * trade a real cost — a language switch that can fail offline — for nothing.
 */

export const SUPPORTED: readonly Lang[] = ['bn', 'en']

/** Reads the stored choice. Bangla when there isn't one. */
function initialLang(): Lang {
  const stored = prefs.get(PrefKeys.lang)
  return stored === 'en' ? 'en' : 'bn'
}

export async function initI18n(): Promise<typeof i18n> {
  await i18n.use(initReactI18next).init({
    resources: { bn: { translation: bn }, en: { translation: en } },
    lng: initialLang(),
    fallbackLng: 'bn',
    // The strings are the source of truth for both locales, so a missing key is
    // a bug to see in development, not a gap to paper over with the key name.
    returnEmptyString: false,
    interpolation: { escapeValue: false },
  })

  /**
   * `qty` and `money` as formatters, so a component can write
   * `t('home.balance', { amount: 1200 })` and get Bengali digits in Bangla and
   * Latin in English without knowing the rule. Identifiers deliberately have no
   * formatter — they must never be localised, so there is nothing to call.
   */
  i18n.services.formatter?.add('qty', (value, lng) =>
    formatQuantity(Number(value), (lng === 'en' ? 'en' : 'bn') as Lang),
  )
  i18n.services.formatter?.add('money', (value, lng) =>
    formatMoney(Number(value), (lng === 'en' ? 'en' : 'bn') as Lang),
  )

  return i18n
}

/**
 * Switches language and remembers it.
 *
 * Neither locale is right-to-left, so nothing here forces a layout direction.
 * The call to `allowRTL(false)` is deliberate all the same: without it, a
 * device set to Arabic or Urdu flips this app's layout to RTL while its text
 * stays Bangla, which reads as a broken screen rather than a translated one.
 */
export async function applyLang(lang: Lang): Promise<void> {
  prefs.set(PrefKeys.lang, lang)
  await i18n.changeLanguage(lang)
}

I18nManager.allowRTL(false)

export { i18n }
export type { Lang }
