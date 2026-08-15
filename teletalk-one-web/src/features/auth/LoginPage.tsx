import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Alert, Button, Checkbox, Field, Stepper } from '../../components/ui'
import { formatIdentifier, maskMsisdn } from '../../i18n/format'
import { ApiError, errorKey } from '../../lib/http'
import { readLocal, StorageKeys, writeLocal } from '../../lib/storage'
import { BrandPanel, ShellBar } from '../shell/BrandPanel'
import { useAuth } from './AuthProvider'
import * as api from './authApi'
import { DEMO_ACCOUNTS } from './demoAccounts'
import './login.css'

const STEPS = ['identity', 'password', 'otp'] as const
type Step = (typeof STEPS)[number]

const POS_LENGTH = 8
const OTP_LENGTH = 6
const RESEND_SECONDS = 60

interface Message {
  key: string
  count?: number
}

export function LoginPage() {
  const { t } = useTranslation()
  const { status, endedByIdle, signIn } = useAuth()
  const location = useLocation()

  const [step, setStep] = useState<Step>('identity')
  // Last POS code is a convenience, not a credential — safe to remember.
  const [posCode, setPosCode] = useState(() => readLocal(StorageKeys.lastPos) ?? '')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  const [msisdn, setMsisdn] = useState('')

  const [busy, setBusy] = useState(false)
  const [fieldError, setFieldError] = useState<Message | null>(null)
  const [formError, setFormError] = useState<Message | null>(null)
  const [resendIn, setResendIn] = useState(0)
  const [resent, setResent] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [step])

  useEffect(() => {
    if (resendIn <= 0) return
    const id = window.setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000)
    return () => window.clearInterval(id)
  }, [resendIn])

  // Abort any request still in flight when the user leaves the screen.
  useEffect(() => () => abortRef.current?.abort(), [])

  const clearErrors = () => {
    setFieldError(null)
    setFormError(null)
  }

  const handleError = (err: unknown) => {
    const key = errorKey(err)
    const count =
      err instanceof ApiError
        ? (err as ApiError & { attemptsLeft?: number }).attemptsLeft
        : undefined
    const detail = err instanceof ApiError ? err.detail : undefined

    // Errors about the value in the box go under the box; errors about the
    // account, the connection or the server go at the top of the form.
    const inline = detail === 'posUnknown' || detail === 'passwordWrong' || detail === 'otpWrong'
    if (inline) setFieldError({ key, count })
    else setFormError({ key, count })
  }

  const run = useCallback(async (fn: (signal: AbortSignal) => Promise<void>) => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    try {
      await fn(controller.signal)
    } finally {
      if (!controller.signal.aborted) setBusy(false)
    }
  }, [])

  const submitIdentity = async () => {
    const value = formatIdentifier(posCode)
    if (!value) return setFieldError({ key: 'error.posRequired' })
    if (value.length !== POS_LENGTH) return setFieldError({ key: 'error.posLength' })

    clearErrors()
    await run(async (signal) => {
      try {
        const res = await api.lookupPos(value, signal)
        writeLocal(StorageKeys.lastPos, value)
        setMsisdn(res.msisdn)
        setStep('password')
      } catch (err) {
        handleError(err)
      }
    })
  }

  const submitPassword = async () => {
    if (!password) return setFieldError({ key: 'error.passwordRequired' })

    clearErrors()
    await run(async (signal) => {
      try {
        const value = formatIdentifier(posCode)
        await api.verifyPassword(value, password, signal)
        await api.requestOtp(value, signal)
        setResendIn(RESEND_SECONDS)
        setStep('otp')
      } catch (err) {
        handleError(err)
      }
    })
  }

  const submitOtp = async () => {
    const value = formatIdentifier(otp)
    if (!value) return setFieldError({ key: 'error.otpRequired' })
    if (value.length !== OTP_LENGTH) return setFieldError({ key: 'error.otpLength' })

    clearErrors()
    await run(async (signal) => {
      try {
        const result = await api.verifyOtp(formatIdentifier(posCode), value, trustDevice, signal)
        signIn(result)
      } catch (err) {
        handleError(err)
      }
    })
  }

  const resend = async () => {
    clearErrors()
    await run(async (signal) => {
      try {
        await api.requestOtp(formatIdentifier(posCode), signal)
        setResendIn(RESEND_SECONDS)
        setResent(true)
        setOtp('')
        inputRef.current?.focus()
      } catch (err) {
        handleError(err)
      }
    })
  }

  const goBack = () => {
    clearErrors()
    setResent(false)
    if (step === 'otp') {
      setOtp('')
      setStep('password')
    } else if (step === 'password') {
      setPassword('')
      setStep('identity')
    }
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (step === 'identity') void submitIdentity()
    else if (step === 'password') void submitPassword()
    else void submitOtp()
  }

  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname
    return <Navigate to={from && from !== '/login' ? from : '/'} replace />
  }

  const msg = (m: Message | null) =>
    m ? t(m.key, m.count !== undefined ? { count: m.count } : undefined) : undefined

  const stepIndex = STEPS.indexOf(step)

  return (
    <div className="shell">
      <BrandPanel />

      <main id="main" className="shell__main" tabIndex={-1}>
        <ShellBar />
        <div className="shell__panel">
          <form className="login" onSubmit={onSubmit} noValidate>
            <header className="login__head">
              <p className="login__eyebrow">
                {t('login.stepOf', { current: stepIndex + 1, total: STEPS.length })}
              </p>
              <h1 className="login__title">{t('login.heading')}</h1>
              <Stepper
                steps={[t('login.stepIdentity'), t('login.stepPassword'), t('login.stepOtp')]}
                current={stepIndex}
                srLabel={t('login.heading')}
              />
            </header>

            <div aria-live="polite" className="login__live">
              {endedByIdle && !formError && <Alert tone="warn">{t('login.idleEnded')}</Alert>}
              {formError && <Alert tone="danger">{msg(formError)}</Alert>}
              {resent && !formError && step === 'otp' && (
                <Alert tone="ok">{t('login.otpResentToast')}</Alert>
              )}
            </div>

            {step === 'identity' && (
              <Field
                ref={inputRef}
                id="posCode"
                identifier
                prefix="BD"
                label={t('login.posLabel')}
                help={t('login.posHelp')}
                error={msg(fieldError)}
                value={posCode}
                onChange={(e) => {
                  // Normalise on input: a Bangla keyboard may produce ২০০৬…
                  setPosCode(formatIdentifier(e.target.value).slice(0, POS_LENGTH))
                  setFieldError(null)
                }}
                placeholder={t('login.posPlaceholder')}
                inputMode="numeric"
                autoComplete="username"
                maxLength={POS_LENGTH}
                enterKeyHint="next"
              />
            )}

            {step === 'password' && (
              <>
                <p className="login__context">
                  <span className="login__context-label">{t('login.posLabel')}</span>
                  <span className="identifier">BD {formatIdentifier(posCode)}</span>
                </p>
                <Field
                  ref={inputRef}
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  label={t('login.passwordLabel')}
                  help={t('login.passwordHelp')}
                  error={msg(fieldError)}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setFieldError(null)
                  }}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  trailing={
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    </Button>
                  }
                />
              </>
            )}

            {step === 'otp' && (
              <>
                <p className="login__context">
                  <span className="login__context-label">{t('login.otpSentLabel')}</span>
                  <span className="identifier">{maskMsisdn(msisdn)}</span>
                </p>
                <Field
                  ref={inputRef}
                  id="otp"
                  identifier
                  label={t('login.otpLabel')}
                  help={t('login.otpHelp')}
                  error={msg(fieldError)}
                  value={otp}
                  onChange={(e) => {
                    setOtp(formatIdentifier(e.target.value).slice(0, OTP_LENGTH))
                    setFieldError(null)
                  }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={OTP_LENGTH}
                  enterKeyHint="go"
                  className="login__otp"
                />

                <div className="login__resend">
                  {resendIn > 0 ? (
                    <span className="login__resend-wait">
                      {t('login.otpResendIn', { seconds: resendIn })}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="link"
                      onClick={() => void resend()}
                      disabled={busy}
                    >
                      {t('login.otpResend')}
                    </Button>
                  )}
                </div>

                <Checkbox
                  id="trustDevice"
                  label={t('login.trustDevice')}
                  help={t('login.trustDeviceHelp')}
                  checked={trustDevice}
                  onChange={setTrustDevice}
                />
              </>
            )}

            <div className="login__actions">
              <Button type="submit" busy={busy} fullWidth>
                {busy
                  ? t('login.checking')
                  : step === 'otp'
                    ? t('login.signIn')
                    : t('login.continue')}
              </Button>
              {step !== 'identity' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={goBack}
                  disabled={busy}
                  fullWidth
                >
                  {t('login.back')}
                </Button>
              )}
            </div>

            <footer className="login__foot">
              <p className="login__foot-title">{t('login.helpTitle')}</p>
              <p className="login__foot-body">{t('login.helpBody')}</p>
              {import.meta.env.DEV && step === 'identity' && (
                <div className="login__demo">
                  <strong>{t('login.demoTitle')}</strong>
                  <span className="identifier">{t('login.demoBody')}</span>
                  <ul className="login__accounts">
                    {DEMO_ACCOUNTS.map((a) => (
                      <li key={a.posCode}>
                        <button
                          type="button"
                          className={`login__account${
                            formatIdentifier(posCode) === a.posCode ? ' is-active' : ''
                          }`}
                          onClick={() => {
                            setPosCode(a.posCode)
                            setFieldError(null)
                          }}
                        >
                          <span>{t(`role.${a.role}`)}</span>
                          <span className="identifier">{a.posCode}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </footer>
          </form>
        </div>
      </main>
    </div>
  )
}
