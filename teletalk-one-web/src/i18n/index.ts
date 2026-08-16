import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import bn from './locales/bn.json'
import { formatIdentifier, formatQuantity, type Lang } from './format'

const STORAGE_KEY = 'teletalk.lang'

/** Bangla is the source locale. English is the translation. */
export const DEFAULT_LANG: Lang = 'bn'

export function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    if (v === 'bn' || v === 'en') return v
  } catch {
    /* private mode / storage disabled */
  }
  return DEFAULT_LANG
}

/**
 * Only Bangla is bundled.
 *
 * By FE-4 the two locale files were the largest single thing in the entry
 * chunk — 911 keys, and Bangla in UTF-8 runs about three bytes a character.
 * Nearly every retailer signs in and stays in Bangla, so shipping English to
 * all of them to serve the few who switch is weight on a 2G first load for no
 * benefit. English arrives as its own chunk, once, the first time somebody
 * asks for it.
 */
const LOADERS: Record<Lang, (() => Promise<{ default: object }>) | null> = {
  bn: null,
  en: () => import('./locales/en.json'),
}

const loaded = new Set<Lang>(['bn'])

async function loadLocale(lang: Lang): Promise<void> {
  if (loaded.has(lang)) return
  const load = LOADERS[lang]
  if (!load) return
  const module = await load()
  i18n.addResourceBundle(lang, 'translation', module.default, true, true)
  loaded.add(lang)
}

void i18n.use(initReactI18next).init({
  resources: { bn: { translation: bn } },
  lng: DEFAULT_LANG,
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
 *
 * Async because the locale may still need fetching. Callers that do not care
 * when it finishes can `void` it — the switch will simply land a moment later,
 * which is what a language toggle does anyway.
 */
export async function applyLang(lang: Lang): Promise<void> {
  await loadLocale(lang)
  await i18n.changeLanguage(lang)
  document.documentElement.setAttribute('lang', lang)
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* ignore */
  }
}

export default i18n
