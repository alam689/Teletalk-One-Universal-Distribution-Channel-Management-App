import { useCallback, useEffect, useRef, useState } from 'react'
import { KeyboardAvoidingView, Platform, Pressable, Switch, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Banner, Button, Card, Field, IconButton, Text } from '../../components/ui'
import { TeletalkMark } from '../../components/TeletalkMark'
import { useTheme } from '../../theme/ThemeProvider'
import { applyLang } from '../../i18n'
import { formatIdentifier, formatQuantity, maskMsisdn, type Lang } from '../../i18n/format'
import { errorKey } from '../../lib/http'
import { prefs, PrefKeys } from '../../lib/storage'
import { logger } from '../../lib/logger'
import * as api from './authApi'
import { useAuth } from './AuthProvider'

/**
 * Sign-in: POS code, password, OTP.
 *
 * Three steps rather than one form, because the middle one can fail in a way
 * the retailer has to act on (wrong password, five attempts, locked) and a
 * combined form would surface that failure next to two fields that were fine.
 *
 * The keyboard is the design constraint here. Every identifier field asks for
 * the number pad, `autoFocus` moves with the step, and the submit button sits
 * above the keyboard rather than under it — a sign-in screen where the button
 * is hidden behind the keypad is the first thing a retailer meets and the first
 * thing they distrust.
 */

type Step = 'identity' | 'password' | 'otp'

const RESEND_SECONDS = 30

export function LoginScreen() {
  const { t, i18n } = useTranslation()
  const { colors, space, theme, toggle } = useTheme()
  const { signIn, endedByIdle } = useAuth()
  const lang = i18n.language as Lang

  const [step, setStep] = useState<Step>('identity')
  const [posCode, setPosCode] = useState(() => prefs.get(PrefKeys.lastPos) ?? '')
  const [password, setPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [trustDevice, setTrustDevice] = useState(false)
  const [msisdn, setMsisdn] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendIn, setResendIn] = useState(0)

  /**
   * The double-tap guard, and it is a ref rather than the `busy` state for the
   * same reason the wizard's is: React batches two taps landing in one tick, so
   * both handlers would read `busy === false` and both would submit.
   */
  const busyRef = useRef(false)

  useEffect(() => {
    if (resendIn <= 0) return
    const timer = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [resendIn])

  const run = useCallback(async (work: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await work()
    } catch (err) {
      logger.warn('sign-in step failed', { err })
      setError(errorKey(err))
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }, [])

  const submitIdentity = () =>
    void run(async () => {
      const code = formatIdentifier(posCode)
      const result = await api.lookupPos(code)
      // Remembered so the next sign-in only asks for the secret. The POS code
      // is printed on the outlet's own signage; it is not a credential.
      prefs.set(PrefKeys.lastPos, code)
      setMsisdn(result.msisdn)
      setStep('password')
    })

  const submitPassword = () =>
    void run(async () => {
      await api.verifyPassword(formatIdentifier(posCode), password)
      await api.requestOtp(formatIdentifier(posCode))
      setResendIn(RESEND_SECONDS)
      setStep('otp')
    })

  const submitOtp = () =>
    void run(async () => {
      const result = await api.verifyOtp(
        formatIdentifier(posCode),
        formatIdentifier(otp),
        trustDevice,
      )
      signIn(result)
    })

  const resend = () =>
    void run(async () => {
      await api.requestOtp(formatIdentifier(posCode))
      setResendIn(RESEND_SECONDS)
    })

  const stepNumber = { identity: 1, password: 2, otp: 3 }[step]

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={{ flex: 1, padding: space.s4, gap: space.s4, justifyContent: 'center' }}>
          {/* Language and theme, as symbols. The same pair the signed-in header
              carries — sign-in is the first screen anyone sees, so the control
              has to be the same on both sides of it. */}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
            <IconButton
              name="globe"
              label={`${t('lang.label')}: ${t('lang.switchTo')}`}
              onPress={() => void applyLang(lang === 'bn' ? 'en' : 'bn')}
            />
            <IconButton
              name={theme === 'dark' ? 'sun' : 'moon'}
              label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
              onPress={toggle}
            />
          </View>

          {/* The same lockup the home screen carries: mark to the LEFT of the
              wordmark in both languages, so the brand does not shift when the
              retailer switches from Bangla to English. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.s3,
            }}
          >
            <TeletalkMark size={48} color={colors.brand} />
            <View style={{ gap: 2 }}>
              <Text variant="title">{t('app.name')}</Text>
              <Text variant="small" tone="muted">
                {t('app.dept')}
              </Text>
            </View>
          </View>

          <Card>
            <Text variant="caption" tone="muted">
              {t('login.stepOf', { current: stepNumber, total: 3 })} ·{' '}
              {t(`login.step${step[0].toUpperCase()}${step.slice(1)}`)}
            </Text>
            <Text variant="heading" weight="700">
              {t('login.heading')}
            </Text>

            {endedByIdle ? (
              <Banner tone="warn" icon="clock" text={t('login.idleEnded')} />
            ) : null}
            {error ? <Banner tone="danger" icon="alert" text={t(error)} /> : null}

            {step === 'identity' ? (
              <>
                <Field
                  label={t('login.posLabel')}
                  help={t('login.posHelp')}
                  value={posCode}
                  onChangeText={setPosCode}
                  placeholder={t('login.posPlaceholder')}
                  identifier
                  maxLength={8}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={submitIdentity}
                />
                <Button
                  label={busy ? t('login.checking') : t('login.continue')}
                  onPress={submitIdentity}
                  busy={busy}
                  disabled={formatIdentifier(posCode).length < 8}
                />
              </>
            ) : null}

            {step === 'password' ? (
              <>
                <Field
                  label={t('login.passwordLabel')}
                  help={t('login.passwordHelp')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoFocus
                  autoCapitalize="none"
                  returnKeyType="go"
                  onSubmitEditing={submitPassword}
                  suffix={
                    <IconButton
                      name={showPassword ? 'lock' : 'search'}
                      label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                      onPress={() => setShowPassword((v) => !v)}
                    />
                  }
                />
                <Button
                  label={busy ? t('login.checking') : t('login.continue')}
                  onPress={submitPassword}
                  busy={busy}
                  disabled={password.length === 0}
                />
                <Button
                  label={t('login.back')}
                  onPress={() => {
                    setStep('identity')
                    setError(null)
                  }}
                  variant="ghost"
                />
              </>
            ) : null}

            {step === 'otp' ? (
              <>
                <Text variant="small" tone="muted">
                  {t('login.otpSentLabel')}{' '}
                  <Text variant="small" identifier weight="600">
                    {maskMsisdn(msisdn)}
                  </Text>
                </Text>
                <Field
                  label={t('login.otpLabel')}
                  help={t('login.otpHelp')}
                  value={otp}
                  onChangeText={setOtp}
                  identifier
                  maxLength={6}
                  autoFocus
                  // The OS reads the code out of the SMS and offers it above the
                  // keyboard. A retailer holding a customer's NID in one hand
                  // should not have to memorise six digits and switch apps.
                  textContentType="oneTimeCode"
                  autoComplete="sms-otp"
                  returnKeyType="go"
                  onSubmitEditing={submitOtp}
                />

                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: space.s3,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text variant="small" weight="600">
                      {t('login.trustDevice')}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {t('login.trustDeviceHelp')}
                    </Text>
                  </View>
                  <Switch
                    value={trustDevice}
                    onValueChange={setTrustDevice}
                    accessibilityLabel={t('login.trustDevice')}
                    trackColor={{ true: colors.brand, false: colors.surface3 }}
                  />
                </View>

                <Button
                  label={busy ? t('login.checking') : t('login.signIn')}
                  onPress={submitOtp}
                  busy={busy}
                  disabled={formatIdentifier(otp).length < 6}
                />
                <Pressable onPress={resendIn > 0 ? undefined : resend} disabled={resendIn > 0}>
                  <Text variant="small" tone={resendIn > 0 ? 'muted' : 'brand'} center>
                    {resendIn > 0
                      ? t('login.otpResendIn', { seconds: resendIn })
                      : t('login.otpResend')}
                  </Text>
                </Pressable>
              </>
            ) : null}
          </Card>

          {/* Demo credentials, and only where they can do no harm: this block is
              gone from any build that has a real API configured. */}
          {__DEV__ ? (
            <Card>
              <Text variant="small" weight="600">
                {t('login.demoTitle')}
              </Text>
              <Text variant="caption" tone="muted" identifier>
                {t('login.demoBody')}
              </Text>
              <Text variant="caption" tone="muted">
                {t('login.helpBody')} · {formatQuantity(121, lang)}
              </Text>
            </Card>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
