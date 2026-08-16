import { Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { Text } from '../components/ui'
import { Icon, type IconName } from '../components/Icon'
import { useTheme } from '../theme/ThemeProvider'
import { useUnsettledCount } from '../features/outbox/OutboxBanner'
import { useAuth } from '../features/auth/AuthProvider'

/**
 * Four tabs and a raised action in the middle.
 *
 * The raised button is the shape every app in this market uses for its one
 * dominant action — send money, scan, pay — and a retailer's is not in doubt:
 * a recharge is the transaction they do forty times a day, and it was three
 * taps away. Now it is one, from anywhere.
 *
 * It is a control, not an ornament: 60pt, labelled, and it disappears for a
 * session that cannot sell airtime rather than sitting there refusing.
 */

const ICONS: Record<string, IconName> = {
  Home: 'home',
  Services: 'grid',
  Outbox: 'cloud',
  Profile: 'user',
}

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { t } = useTranslation()
  const { colors, space, radius } = useTheme()
  const insets = useSafeAreaInsets()
  const pending = useUnsettledCount()
  const { can } = useAuth()
  // Gated like every other entry point: a session that cannot sell airtime gets
  // no button rather than one that refuses.
  const canSell = can('recharge.sell')

  // The centre action splits the row in two. An odd number of tabs would put a
  // tab under the button, so the four are laid out as two and two.
  const left = state.routes.slice(0, 2)
  const right = state.routes.slice(2)

  const Tab = ({ route, index }: { route: (typeof state.routes)[number]; index: number }) => {
    const focused = state.index === index
    const { options } = descriptors[route.key]
    const label = typeof options.title === 'string' ? options.title : route.name

    return (
      <Pressable
        key={route.key}
        onPress={() => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          })
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
        }}
        accessibilityRole="button"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={label}
        style={{
          flex: 1,
          minHeight: 52,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          paddingTop: space.s2,
        }}
      >
        <View>
          <Icon
            name={ICONS[route.name] ?? 'grid'}
            size={23}
            color={focused ? colors.brand : colors.muted}
          />
          {/* The count, not a dot: "three transactions unconfirmed" is a
              different decision from "one", and the retailer is owed the
              number even from the tab bar. */}
          {route.name === 'Outbox' && pending > 0 ? (
            <View
              style={{
                position: 'absolute',
                top: -4,
                right: -10,
                minWidth: 18,
                height: 18,
                paddingHorizontal: 4,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.danger,
              }}
            >
              <Text variant="caption" weight="700" tone="onBrand">
                {pending}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          variant="caption"
          weight={focused ? '700' : '400'}
          tone={focused ? 'brand' : 'muted'}
        >
          {label}
        </Text>
      </Pressable>
    )
  }

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingBottom: insets.bottom,
        backgroundColor: colors.surface,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.ruleSoft,
      }}
    >
      {left.map((route) => (
        <Tab key={route.key} route={route} index={state.routes.indexOf(route)} />
      ))}

      {canSell ? (
        <Pressable
          onPress={() => navigation.navigate('Sale', { id: 'recharge' })}
          accessibilityRole="button"
          accessibilityLabel={t('item.recharge')}
          style={({ pressed }) => ({
            width: 76,
            alignItems: 'center',
            // Lifted above the bar, the way the market's apps do it. The bar
            // itself keeps its height, so nothing else moves.
            marginTop: -22,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <View
            style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brand,
              borderWidth: 4,
              borderColor: colors.surface,
            }}
          >
            <Icon name="bolt" size={28} color={colors.onBrand} />
          </View>
          <Text variant="caption" weight="600" tone="brand" numberOfLines={1}>
            {t('item.recharge')}
          </Text>
        </Pressable>
      ) : null}

      {right.map((route) => (
        <Tab key={route.key} route={route} index={state.routes.indexOf(route)} />
      ))}

      {/* Keeps the raised button's label clear of the gesture bar. */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          height: insets.bottom,
          width: '100%',
        }}
      />
    </View>
  )
}
