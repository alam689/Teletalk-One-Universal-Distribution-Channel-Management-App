import { useCallback, useMemo } from 'react'
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { LinearGradient } from 'expo-linear-gradient'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Text } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { TeletalkMark } from '../../components/TeletalkMark'
import { useTheme } from '../../theme/ThemeProvider'
import { formatMoney, formatQuantity, type Lang } from '../../i18n/format'
import { useResource } from '../../lib/useResource'
import { useAuth, useSession } from '../auth/AuthProvider'
import { getCommission, getStock } from '../counter/counterApi'
import { StatusBanners, useUnsettledCount } from '../outbox/OutboxBanner'
import { menuFor, type Destination, type MenuItem } from './menu'

/**
 * The counter's first screen, in the shape a Bangladeshi retailer already
 * knows: a green brand band, the account strip riding on it, and white sheets
 * carrying a three-column grid of everything the outlet can do.
 *
 * That is not imitation for its own sake. A retailer moves between four or five
 * banking and MFS apps on the same handset in a working day, and a home screen
 * that puts the grid where the others put it is a home screen they can already
 * use.
 *
 * **The whole screen is one scroll view.** The band is the first thing inside
 * it rather than a sibling above it, and the account strip overlaps it with a
 * negative margin. Two boxes overlapping across a scroll boundary is what
 * clipped the strip's top half the first time this was built.
 *
 * **The grid is grouped.** One flat run of twenty-six tiles is a wall; the
 * eight groups are how a retailer already thinks about the work — SIM, MNP,
 * recharge, stock, money, reports, campaigns, service — and each gets a heading
 * and its own sheet, so the separator between them is space rather than a line
 * to squint at.
 */
export function HomeScreen() {
  const { t, i18n } = useTranslation()
  const { colors, space, radius, category, theme } = useTheme()
  const insets = useSafeAreaInsets()
  const navigation = useNavigation<{ navigate: (screen: string, params?: object) => void }>()
  const session = useSession()
  const { can } = useAuth()
  const lang = i18n.language as Lang
  const pending = useUnsettledCount()

  // Balance and today's commission come from the session: the sign-in response
  // already carries them, and a home screen that waits on two requests before
  // it can show a number is blank for three seconds on a 2G handover. The live
  // reads refresh what changes while the app is open.
  const { balance, commissionToday } = session.stats
  const commission = useResource('commission-today', (signal) => getCommission('today', signal))
  const stock = useResource('stock-sim', (signal) => getStock('sim', signal))

  const reload = useCallback(() => {
    commission.reload()
    stock.reload()
  }, [commission, stock])

  const groups = useMemo(() => menuFor(can), [can])

  const go = (to: Destination) =>
    navigation.navigate(to.screen, to.id ? { id: to.id } : undefined)

  /** The band stays dark in both themes — it always carries white text. */
  const band: readonly [string, string] =
    theme === 'dark' ? ['#04241a', '#075437'] : ['#0b7a4f', '#12a06a']

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.paper }}
      contentContainerStyle={{ paddingBottom: space.s8 }}
      refreshControl={
        <RefreshControl
          refreshing={commission.loading || stock.loading}
          onRefresh={reload}
          tintColor={colors.brand}
          progressViewOffset={insets.top}
        />
      }
    >
      <LinearGradient
        colors={band}
        style={{ paddingTop: insets.top + space.s4, paddingBottom: space.s7 }}
      >
        {/* The mark sits to the LEFT of the wordmark, in both languages. It is
            a lockup, not a stack: Bangla and English set to different widths,
            and a centred mark above a centred word drifts visibly when the
            language flips. Left of the name it stays put. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.s3,
          }}
        >
          <TeletalkMark size={44} color={colors.onBrand} />
          <View style={{ gap: 2 }}>
            <Text variant="title" tone="onBrand">
              {t('app.name')}
            </Text>
            <Text variant="caption" style={{ color: colors.onBrandSoft }}>
              {t('app.dept')}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* The account strip, overlapping the band. The overflow opens the
          profile, which is where the outlet's details and sign-out live. */}
      <View
        style={{
          // Above the band. A gradient establishes its own stacking context on
          // web and elevates itself on Android, so without this the strip's
          // first line is painted over — which is exactly what it did.
          zIndex: 1,
          elevation: 2,
          marginTop: -space.s5,
          marginHorizontal: space.s3,
          padding: space.s4,
          borderTopLeftRadius: radius.lg,
          borderTopRightRadius: radius.lg,
          backgroundColor: colors.brandPanel,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
        }}
      >
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(255,255,255,0.18)',
          }}
        >
          <Icon name="store" size={24} color={colors.onBrand} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="body" weight="700" tone="onBrand" numberOfLines={1}>
            {session.name[lang]}
          </Text>
          <Text variant="caption" identifier style={{ color: colors.onBrandSoft }}>
            BD {session.posCode}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate('Profile')}
          accessibilityRole="button"
          accessibilityLabel={t('nav.account')}
          hitSlop={8}
          style={{ width: 32, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="list" size={20} color={colors.onBrand} />
        </Pressable>
      </View>

      {/* Float, commission, stock, queue. Two by two rather than four across:
          "টেলিচার্জ ব্যালান্স" does not fit in a quarter of a 360px screen, and
          a truncated label on the one number a retailer opens the app for is
          not a trade worth making. */}
      <View
        style={{
          marginHorizontal: space.s3,
          padding: space.s3,
          borderBottomLeftRadius: radius.lg,
          borderBottomRightRadius: radius.lg,
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderTopWidth: 0,
          borderColor: colors.ruleSoft,
          flexDirection: 'row',
          flexWrap: 'wrap',
        }}
      >
        <Figure
          label={t('home.balanceLabel')}
          value={balance === undefined ? '—' : formatMoney(balance, lang)}
          strong
        />
        <Figure
          label={t('home.commissionLabel')}
          value={formatMoney(commission.data?.total ?? commissionToday ?? 0, lang)}
        />
        <Figure
          label={t('home.stockLabel')}
          value={formatQuantity(stock.data?.total ?? session.stats.simStock ?? 0, lang)}
        />
        <Figure label={t('home.pendingLabel')} value={formatQuantity(pending, lang)} />
      </View>

      <View style={{ paddingHorizontal: space.s3, paddingTop: space.s3 }}>
        <StatusBanners />
      </View>

      {groups.map((group) => (
        <View key={group.id} style={{ marginTop: space.s4 }}>
          {/* The heading, with the rule running off to the right — the
              separator between one kind of work and the next. */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space.s3,
              marginHorizontal: space.s4,
              marginBottom: space.s2,
            }}
          >
            <Text variant="small" weight="700" tone="soft">
              {t(`group.${group.id}`)}
            </Text>
            <View
              style={{
                flex: 1,
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.rule,
              }}
            />
          </View>

          <View
            style={{
              marginHorizontal: space.s3,
              borderRadius: radius.xl,
              backgroundColor: colors.surface,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: colors.ruleSoft,
              overflow: 'hidden',
              flexDirection: 'row',
              flexWrap: 'wrap',
            }}
          >
            {group.items.map((item, index) => (
              <Cell
                key={item.id}
                item={item}
                index={index}
                total={group.items.length}
                onPress={() => go(item.to)}
                tint={category(item.category)}
              />
            ))}
          </View>
        </View>
      ))}

      {/* Where a bank app carries an advert. The retailer's equivalent is the
          one message that prevents the fraud this channel actually sees:
          nobody from Teletalk ever asks for an OTP. */}
      <View
        style={{
          margin: space.s3,
          marginTop: space.s5,
          padding: space.s4,
          borderRadius: radius.lg,
          backgroundColor: colors.brandWash,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s3,
        }}
      >
        <Icon name="shield" size={28} color={colors.brand} />
        <Text variant="small" tone="brand" weight="600" style={{ flex: 1 }}>
          {t('home.otpNotice')}
        </Text>
      </View>
    </ScrollView>
  )
}

/* --------------------------------- pieces --------------------------------- */

function Figure({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const { space } = useTheme()
  return (
    <View
      style={{ flexBasis: '50%', gap: 2, paddingVertical: space.s2, paddingRight: space.s2 }}
    >
      <Text variant="caption" tone="muted" numberOfLines={1}>
        {label}
      </Text>
      <Text variant="small" weight="700" tone={strong ? 'brand' : 'ink'} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

function Cell({
  item,
  index,
  total,
  onPress,
  tint,
}: {
  item: MenuItem
  index: number
  total: number
  onPress: () => void
  tint: { well: string; ink: string }
}) {
  const { t } = useTranslation()
  const { colors, space } = useTheme()

  // The cell draws its own dividers, so the last column and the last row do not
  // end in a stray line. `flexBasis: 33.33%` rather than three fixed tracks
  // keeps a three-item group and a seven-item one looking like one screen.
  // Also the last item: a five-tile group ends two across, and a right border
  // drawn against empty space is a line to nowhere.
  const lastColumn = index % 3 === 2 || index === total - 1
  const rows = Math.ceil(total / 3)
  const lastRow = Math.floor(index / 3) === rows - 1

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t(`item.${item.id}`)}
      style={({ pressed }) => ({
        flexBasis: '33.33%',
        alignItems: 'center',
        gap: space.s2,
        paddingVertical: space.s4,
        paddingHorizontal: space.s2,
        backgroundColor: pressed ? colors.surface2 : 'transparent',
        borderRightWidth: lastColumn ? 0 : StyleSheet.hairlineWidth,
        borderBottomWidth: lastRow ? 0 : StyleSheet.hairlineWidth,
        borderColor: colors.ruleSoft,
      })}
    >
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tint.well,
        }}
      >
        <Icon name={item.icon} size={26} color={tint.ink} />
      </View>
      <Text variant="caption" weight="600" center numberOfLines={2}>
        {t(`item.${item.id}`)}
      </Text>
    </Pressable>
  )
}
