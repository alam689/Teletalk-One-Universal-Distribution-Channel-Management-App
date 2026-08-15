import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Field } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { errorKey } from '../../lib/http'
import { changePassword } from '../auth/authApi'
import { PASSWORD_POLICY } from '../auth/authTypes'
import './password.css'

export interface PasswordRule {
  id: string
  labelKey: string
  count?: number
  test: (next: string, confirm: string) => boolean
}

/** Exported so the rules are unit-tested directly rather than through the DOM. */
export const PASSWORD_RULES: PasswordRule[] = [
  {
    id: 'length',
    labelKey: 'password.ruleLength',
    count: PASSWORD_POLICY.minLength,
    test: (n) => n.length >= PASSWORD_POLICY.minLength,
  },
  { id: 'upper', labelKey: 'password.ruleUpper', test: (n) => /[A-Z]/.test(n) },
  { id: 'digit', labelKey: 'password.ruleDigit', test: (n) => /[0-9]/.test(n) },
  { id: 'symbol', labelKey: 'password.ruleSymbol', test: (n) => /[^A-Za-z0-9]/.test(n) },
  { id: 'match', labelKey: 'password.ruleMatch', test: (n, c) => n.length > 0 && n === c },
]

export default function ChangePasswordPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  useEffect(() => () => abortRef.current?.abort(), [])

  const results = useMemo(
    () => PASSWORD_RULES.map((r) => ({ ...r, ok: r.test(next, confirm) })),
    [next, confirm],
  )
  const allOk = results.every((r) => r.ok)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!current) return setError('error.passwordRequired')
    if (next !== confirm) return setError('error.passwordMismatch')
    if (!allOk) return setError('error.passwordPolicy')

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setBusy(true)
    try {
      await changePassword(current, next, controller.signal)
      setDone(true)
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setError(errorKey(err))
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="pwd">
        <h1 className="pwd__title">{t('password.title')}</h1>
        <Alert tone="ok">{t('password.done')}</Alert>
        <div className="pwd__actions">
          <Button onClick={() => navigate('/profile')}>{t('nav.backToProfile')}</Button>
        </div>
      </div>
    )
  }

  return (
    <form className="pwd" onSubmit={submit} noValidate>
      <header className="pwd__head">
        <h1 className="pwd__title">{t('password.title')}</h1>
        <p className="pwd__intro">{t('password.intro')}</p>
      </header>

      <div aria-live="polite">{error && <Alert tone="danger">{t(error)}</Alert>}</div>

      <Field
        id="currentPassword"
        type={show ? 'text' : 'password'}
        label={t('password.current')}
        value={current}
        onChange={(e) => {
          setCurrent(e.target.value)
          setError(null)
        }}
        autoComplete="current-password"
      />

      <Field
        id="newPassword"
        type={show ? 'text' : 'password'}
        label={t('password.next')}
        value={next}
        onChange={(e) => {
          setNext(e.target.value)
          setError(null)
        }}
        autoComplete="new-password"
        trailing={
          <Button
            type="button"
            variant="link"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
          >
            {show ? t('login.hidePassword') : t('login.showPassword')}
          </Button>
        }
      />

      <Field
        id="confirmPassword"
        type={show ? 'text' : 'password'}
        label={t('password.confirm')}
        value={confirm}
        onChange={(e) => {
          setConfirm(e.target.value)
          setError(null)
        }}
        autoComplete="new-password"
      />

      {/* Rules are shown up front and tick live, rather than being revealed one
          at a time by failed submissions. */}
      <section className="pwd__rules">
        <h2 className="pwd__rules-title">{t('password.rules')}</h2>
        <ul>
          {results.map((r) => (
            <li key={r.id} className={r.ok ? 'is-ok' : undefined}>
              <span className="pwd__tick" aria-hidden="true">
                {r.ok ? <Icon name="check" size={14} /> : <span className="pwd__dot" />}
              </span>
              {t(r.labelKey, r.count !== undefined ? { count: r.count } : undefined)}
              <span className="visually-hidden">
                {r.ok ? t('password.ruleMet') : t('password.ruleUnmet')}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="pwd__actions">
        <Button type="submit" busy={busy}>
          {busy ? t('password.saving') : t('password.submit')}
        </Button>
        <Button type="button" variant="ghost" onClick={() => navigate(-1)} disabled={busy}>
          {t('nav.back')}
        </Button>
      </div>
    </form>
  )
}
