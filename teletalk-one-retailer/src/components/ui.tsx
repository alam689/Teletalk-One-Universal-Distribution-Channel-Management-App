import { forwardRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type ScrollViewProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native'
import { useTranslation } from 'react-i18next'
import { useTheme } from '../theme/ThemeProvider'
import { monoFamily } from '../theme/tokens'
import { Icon, type IconName } from './Icon'

/**
 * The primitives every screen is built from.
 *
 * There is no cascade in React Native, so the equivalent of the portal's
 * stylesheet is this file: one place that knows what a heading, a card, a
 * button and a field look like. A screen that reaches past it and writes its
 * own `fontSize` has started a second design system.
 */

/* --------------------------------- text ---------------------------------- */

type TextTone = 'ink' | 'soft' | 'muted' | 'brand' | 'danger' | 'ok' | 'warn' | 'onBrand'
type TextVariant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'caption'

export interface TextProps {
  children: ReactNode
  variant?: TextVariant
  tone?: TextTone
  weight?: '400' | '600' | '700'
  /**
   * Identifiers — MSISDN, NID, SIM serial, POS code, transaction ID.
   * Monospaced and never localised, because they are dictated over the phone
   * and matched against BVS, CBS and ERP, none of which read Bengali digits.
   */
  identifier?: boolean
  center?: boolean
  numberOfLines?: number
  style?: StyleProp<TextStyle>
}

export function Text({
  children,
  variant = 'body',
  tone = 'ink',
  weight,
  identifier,
  center,
  numberOfLines,
  style,
}: TextProps) {
  const { colors, font, lh } = useTheme()

  const size = {
    display: font.xxl,
    title: font.xl,
    heading: font.lg,
    body: font.base,
    small: font.sm,
    caption: font.xs,
  }[variant]

  const tones: Record<TextTone, string> = {
    ink: colors.ink,
    soft: colors.inkSoft,
    muted: colors.muted,
    brand: colors.brand,
    danger: colors.danger,
    ok: colors.ok,
    warn: colors.warn,
    onBrand: colors.onBrand,
  }

  const tight = variant === 'display' || variant === 'title'

  return (
    <RNText
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: size,
          color: tones[tone],
          lineHeight: size * (tight ? lh.tight : lh.body),
          fontWeight: weight ?? (variant === 'display' || variant === 'title' ? '700' : '400'),
          textAlign: center ? 'center' : 'auto',
        },
        identifier && {
          fontFamily: Platform.select(monoFamily),
          // Identifiers are read digit by digit; a little tracking stops 8 and
          // B, 0 and O running together on a low-DPI budget handset.
          letterSpacing: 0.3,
        },
        style,
      ]}
    >
      {children}
    </RNText>
  )
}

/* -------------------------------- surfaces ------------------------------- */

export function Card({
  children,
  style,
  tone = 'surface',
}: {
  children: ReactNode
  style?: StyleProp<ViewStyle>
  tone?: 'surface' | 'brand'
}) {
  const { colors, radius, space } = useTheme()
  return (
    <View
      style={[
        {
          padding: space.s4,
          borderRadius: radius.lg,
          backgroundColor: tone === 'brand' ? colors.brandPanel : colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tone === 'brand' ? colors.brandPanel : colors.ruleSoft,
          gap: space.s3,
        },
        // Elevation rather than a drawn shadow: Android ignores shadowColor and
        // iOS ignores elevation, so both are set and each platform takes one.
        Platform.select({
          android: { elevation: 1 },
          default: {
            shadowColor: '#083020',
            shadowOpacity: 0.08,
            shadowRadius: 14,
            shadowOffset: { width: 0, height: 6 },
          },
        }),
        style,
      ]}
    >
      {children}
    </View>
  )
}

export function Divider() {
  const { colors, space } = useTheme()
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: colors.rule,
        marginVertical: space.s1,
      }}
    />
  )
}

/* --------------------------------- button -------------------------------- */

export interface ButtonProps {
  label: string
  onPress: () => void
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  icon?: IconName
  busy?: boolean
  disabled?: boolean
  /** Fills its row. Primary actions do; a pair of secondaries usually doesn't. */
  block?: boolean
  style?: StyleProp<ViewStyle>
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  busy,
  disabled,
  block = true,
  style,
}: ButtonProps) {
  const { colors, radius, space, tapMin, font } = useTheme()
  const off = disabled || busy

  const bg = {
    primary: colors.brand,
    secondary: colors.surface,
    ghost: 'transparent',
    danger: colors.dangerWash,
  }[variant]

  const fg = {
    primary: colors.onBrand,
    secondary: colors.ink,
    ghost: colors.brand,
    danger: colors.danger,
  }[variant]

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!busy }}
      accessibilityLabel={label}
      style={({ pressed }) => [
        {
          minHeight: tapMin,
          flexGrow: block ? 1 : 0,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.s2,
          paddingHorizontal: space.s5,
          paddingVertical: space.s3,
          borderRadius: radius.base,
          backgroundColor: bg,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: colors.ruleControl,
          // Opacity, not a colour swap: a disabled button that changes hue
          // reads as a different button rather than the same one, unavailable.
          opacity: off ? 0.55 : pressed ? 0.88 : 1,
        },
        style,
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={fg} /> : null}
      {!busy && icon ? <Icon name={icon} size={18} color={fg} /> : null}
      <RNText style={{ color: fg, fontSize: font.base, fontWeight: '700' }}>{label}</RNText>
    </Pressable>
  )
}

/** A 44pt icon-only control. Always carries an accessible label. */
export function IconButton({
  name,
  onPress,
  label,
  color,
  badge,
}: {
  name: IconName
  onPress: () => void
  label: string
  color?: string
  badge?: boolean
}) {
  const { colors, radius, tapMin } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: tapMin,
        height: tapMin,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.base,
        backgroundColor: pressed ? colors.surface2 : 'transparent',
      })}
    >
      <Icon name={name} size={22} color={color ?? colors.inkSoft} />
      {badge ? (
        <View
          style={{
            position: 'absolute',
            top: 9,
            right: 10,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.danger,
            borderWidth: 2,
            borderColor: colors.surface,
          }}
        />
      ) : null}
    </Pressable>
  )
}

/* --------------------------------- field --------------------------------- */

export interface FieldProps extends Omit<TextInputProps, 'style' | 'onChangeText'> {
  label: string
  value: string
  onChangeText: (value: string) => void
  help?: string
  /** An `error.*` message, already translated. Announced, not just coloured. */
  error?: string
  /** Identifier input: monospaced, Latin-only, numeric keypad. */
  identifier?: boolean
  suffix?: ReactNode
}

export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, value, onChangeText, help, error, identifier, suffix, ...rest },
  ref,
) {
  const { colors, radius, space, font, tapMin } = useTheme()
  return (
    <View style={{ gap: space.s2 }}>
      <Text variant="small" tone="soft" weight="600">
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
        <TextInput
          ref={ref}
          value={value}
          onChangeText={onChangeText}
          accessibilityLabel={label}
          accessibilityHint={help}
          placeholderTextColor={colors.muted}
          keyboardType={identifier ? 'number-pad' : rest.keyboardType}
          autoCapitalize={identifier ? 'none' : rest.autoCapitalize}
          autoCorrect={identifier ? false : rest.autoCorrect}
          {...rest}
          style={{
            flex: 1,
            minHeight: tapMin,
            paddingHorizontal: space.s4,
            paddingVertical: space.s3,
            borderRadius: radius.base,
            // 3:1 against the surface. `rule` is 1.19:1 — invisible to a
            // low-vision retailer looking for the box on a bright counter.
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.ruleControl,
            backgroundColor: colors.surface,
            color: colors.ink,
            fontSize: font.base,
            ...(identifier
              ? { fontFamily: Platform.select(monoFamily), letterSpacing: 0.4 }
              : null),
          }}
        />
        {suffix}
      </View>
      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : help ? (
        <Text variant="caption" tone="muted">
          {help}
        </Text>
      ) : null}
    </View>
  )
})

/* --------------------------------- pill ---------------------------------- */

export function Pill({
  label,
  tone = 'muted',
}: {
  label: string
  tone?: 'ok' | 'warn' | 'danger' | 'muted' | 'brand'
}) {
  const { colors, radius, space, font } = useTheme()
  const map = {
    ok: { bg: colors.okWash, fg: colors.ok },
    warn: { bg: colors.warnWash, fg: colors.warn },
    danger: { bg: colors.dangerWash, fg: colors.danger },
    muted: { bg: colors.surface2, fg: colors.muted },
    brand: { bg: colors.brandWash, fg: colors.brand },
  }[tone]
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: space.s3,
        paddingVertical: 3,
        borderRadius: radius.pill,
        backgroundColor: map.bg,
      }}
    >
      <RNText style={{ color: map.fg, fontSize: font.xs, fontWeight: '700' }}>{label}</RNText>
    </View>
  )
}

/* -------------------------------- metric --------------------------------- */

export function Metric({
  label,
  value,
  hint,
  strong,
}: {
  label: string
  value: string
  hint?: string
  strong?: boolean
}) {
  const { colors, radius, space } = useTheme()
  return (
    <View
      style={{
        flexGrow: 1,
        flexBasis: '46%',
        gap: 2,
        padding: space.s4,
        borderRadius: radius.base,
        backgroundColor: strong ? colors.brandWash : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: strong ? colors.brandBright : colors.ruleSoft,
      }}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Text variant="heading" weight="700" tone={strong ? 'brand' : 'ink'}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" tone="muted">
          {hint}
        </Text>
      ) : null}
    </View>
  )
}

/* -------------------------------- feedback -------------------------------- */

export function Banner({
  tone,
  text,
  icon,
}: {
  tone: 'ok' | 'warn' | 'danger' | 'brand'
  text: string
  icon?: IconName
}) {
  const { colors, radius, space } = useTheme()
  const map = {
    ok: { bg: colors.okWash, fg: colors.ok },
    warn: { bg: colors.warnWash, fg: colors.warn },
    danger: { bg: colors.dangerWash, fg: colors.danger },
    brand: { bg: colors.brandWash, fg: colors.brand },
  }[tone]
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: space.s3,
        padding: space.s4,
        borderRadius: radius.base,
        backgroundColor: map.bg,
        borderLeftWidth: 3,
        borderLeftColor: map.fg,
      }}
    >
      {icon ? <Icon name={icon} size={20} color={map.fg} /> : null}
      <RNText style={{ flex: 1, color: map.fg, fontSize: 14, lineHeight: 22 }}>{text}</RNText>
    </View>
  )
}

export function EmptyState({
  icon,
  title,
  body,
}: {
  icon: IconName
  title: string
  body?: string
}) {
  const { colors, space } = useTheme()
  return (
    <View style={{ alignItems: 'center', gap: space.s3, paddingVertical: space.s7 }}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface2,
        }}
      >
        <Icon name={icon} size={24} color={colors.muted} />
      </View>
      <Text variant="body" weight="600" center>
        {title}
      </Text>
      {body ? (
        <Text variant="small" tone="muted" center style={{ maxWidth: 320 }}>
          {body}
        </Text>
      ) : null}
    </View>
  )
}

/** Three grey bars. Shape of the content, not a spinner in the middle of it. */
export function Skeleton({ rows = 3 }: { rows?: number }) {
  const { colors, radius, space } = useTheme()
  return (
    <View style={{ gap: space.s3 }} accessibilityElementsHidden>
      {Array.from({ length: rows }, (_, i) => (
        <View
          key={i}
          style={{ height: 52, borderRadius: radius.base, backgroundColor: colors.surface2 }}
        />
      ))}
    </View>
  )
}

/* --------------------------------- rows ---------------------------------- */

export function DataRow({
  label,
  value,
  identifier,
}: {
  label: string
  value: string
  identifier?: boolean
}) {
  const { colors, space } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: space.s4,
        paddingVertical: space.s2,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.ruleSoft,
      }}
    >
      <Text variant="small" tone="muted" style={{ flexShrink: 1 }}>
        {label}
      </Text>
      <Text
        variant="small"
        weight="600"
        identifier={identifier}
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Text>
    </View>
  )
}

/** A tappable row: the list-item shape used by every queue in the app. */
export function ListRow({
  title,
  subtitle,
  right,
  rightTone,
  onPress,
  icon,
  identifierTitle,
}: {
  title: string
  subtitle?: string
  right?: string
  rightTone?: TextTone
  onPress?: () => void
  icon?: IconName
  identifierTitle?: boolean
}) {
  const { colors, radius, space, tapMin } = useTheme()
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s3,
        minHeight: tapMin,
        padding: space.s3,
        borderRadius: radius.base,
        backgroundColor: pressed ? colors.surface2 : colors.surface,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.ruleSoft,
      })}
    >
      {icon ? <Icon name={icon} size={20} color={colors.brand} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant="small" weight="600" identifier={identifierTitle}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted">
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? (
        <Text variant="small" weight="700" tone={rightTone}>
          {right}
        </Text>
      ) : null}
      {onPress ? <Icon name="chevron" size={16} color={colors.muted} /> : null}
    </Pressable>
  )
}

/* -------------------------------- screen --------------------------------- */

/**
 * The page frame. Scrolls, keeps the mint ground, and leaves room under the
 * last control — a submit button flush against the bottom of a phone screen is
 * the one a thumb misses.
 */
export function Screen({
  children,
  scroll = true,
  refreshControl,
}: {
  children: ReactNode
  scroll?: boolean
  refreshControl?: ScrollViewProps['refreshControl']
}) {
  const { colors, space } = useTheme()
  const body = (
    <View style={{ gap: space.s4, padding: space.s4, paddingBottom: space.s8 }}>{children}</View>
  )
  if (!scroll) {
    return <View style={{ flex: 1, backgroundColor: colors.paper }}>{body}</View>
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      keyboardShouldPersistTaps="handled"
      refreshControl={refreshControl}
    >
      {body}
    </ScrollView>
  )
}

/** Section heading with an optional action on the right. */
export function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  const { space } = useTheme()
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.s3,
      }}
    >
      <Text variant="heading" weight="700">
        {title}
      </Text>
      {action}
    </View>
  )
}

/** Loading, empty, broken or fine — the four states every read screen has. */
export function ResourceView<T>({
  state,
  children,
  emptyIcon = 'list',
  emptyTitle,
  emptyBody,
  onRetry,
}: {
  state: { data: T | null; loading: boolean; errorKey: string | null; isEmpty?: boolean }
  children: (data: T) => ReactNode
  emptyIcon?: IconName
  emptyTitle: string
  emptyBody?: string
  onRetry?: () => void
}) {
  const { t } = useTranslation()
  const { space } = useTheme()

  if (state.loading && !state.data) return <Skeleton />
  if (state.errorKey) {
    return (
      <View style={{ gap: space.s3 }}>
        <Banner tone="danger" icon="alert" text={t(state.errorKey)} />
        {onRetry ? (
          <Button label={t('data.retry')} onPress={onRetry} variant="secondary" icon="refresh" />
        ) : null}
      </View>
    )
  }
  if (!state.data || state.isEmpty) {
    return <EmptyState icon={emptyIcon} title={emptyTitle} body={emptyBody} />
  }
  return <>{children(state.data)}</>
}
