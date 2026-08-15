import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import bn from './locales/bn.json'
import en from './locales/en.json'
import { formatIdentifier, formatQuantity, type Lang } from './format'

const STORAGE_KEY = 'teletalk.lang'

/** Bangla is the source locale. English is the translation. */
export const DEFAULT_LANG: Lang = 'bn'

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'bn' || v === 'en') return v
  } catch {
    /* private mode / storage disabled */
  }
  return DEFAULT_LANG
}

void i18n.use(initReactI18next).init({
  resources: {
    bn: { translation: bn },
    en: { translation: en },
  },
  lng: readStoredLang(),
  fallbackLng: DEFAULT_LANG,
  interpolation: {
    escapeValue: false,
    /**
     * The numeral rule lives here, not at the call site.
     *
     * Without this, i18next interpolates the raw JS number and a Bangla
     * sentence renders "আর 4 বার" instead of "আর ৪ বার". Centralising it
     * means a developer cannot forget:
     *
     *   {{count, qty}}   quantity  → Bengali digits in bn
     *   {{msisdn, id}}   identifier → always Latin
     */
    format: (value, format, lng) => {
      if (format === 'qty') return formatQuantity(Number(value), (lng as Lang) ?? DEFAULT_LANG)
      if (format === 'id') return formatIdentifier(String(value))
      return String(value)
    },
  },
  returnNull: false,
})

/**
 * Language and script are a document-level concern: `lang` drives font
 * selection and hyphenation, and our CSS keys Bangla line-height off it.
 */
export function applyLang(lang: Lang): void {
  void i18n.changeLanguage(lang)
  document.documentElement.setAttribute('lang', lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

applyLang(readStoredLang())

export default i18n
