import { useCallback } from 'react'
import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { NavigationContainer, type Theme as NavTheme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { IconButton } from '../components/ui'
import { useTheme } from '../theme/ThemeProvider'
import { applyLang } from '../i18n'
import type { Lang } from '../i18n/format'
import { useAuth } from '../features/auth/AuthProvider'
import { LoginScreen } from '../features/auth/LoginScreen'
import { HomeScreen } from '../features/home/HomeScreen'
import { ServicesScreen } from '../features/home/ServicesScreen'
import { ProfileScreen } from '../features/profile/ProfileScreen'
import { OutboxScreen } from '../features/outbox/OutboxScreen'
import { FlowScreen } from '../features/activation/FlowScreen'
import { SaleScreen } from '../features/recharge/SaleScreen'
import {
  CampaignsScreen,
  CommissionScreen,
  CustomerSearchScreen,
  NotificationsScreen,
  OffersScreen,
  OutstandingScreen,
  SalesReportScreen,
  StockScreen,
  SupportScreen,
  TargetScreen,
  TransactionsScreen,
} from '../features/counter/ReadScreens'
import { ComplaintScreen, RequisitionScreen, WalletScreen } from '../features/ops/OpsScreens'
import { TabBar } from './TabBar'

/**
 * Three tabs and a stack.
 *
 * The portal has a top nav and a bottom bar depending on width; a phone has one
 * answer, and it is the bottom bar — the top of a 6.5" screen is not somewhere
 * a thumb goes while the other hand is holding a customer's NID.
 *
 * Everything reachable from the catalogue is a **stack** screen rather than a
 * fourth tab. A tab bar is for places you return to; a recharge is somewhere
 * you go, finish, and leave, and it needs the back button that comes with it.
 */

const Tabs = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

/** Language and theme, as symbols. Present on every screen's header. */
function HeaderControls() {
  const { t, i18n } = useTranslation()
  const { theme, toggle, space } = useTheme()
  const lang = i18n.language as Lang
  return (
    <View style={{ flexDirection: 'row', gap: space.s1 }}>
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
  )
}

function MainTabs() {
  const { t } = useTranslation()
  const { colors } = useTheme()

  return (
    <Tabs.Navigator
      // The bar is ours: four tabs and a raised action in the middle, which
      // React Navigation's own bar has no shape for.
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.ink,
        headerRight: () => <HeaderControls />,
      }}
    >
      <Tabs.Screen
        name="Home"
        component={HomeScreen}
        // Home paints its own brand band and account strip, so the navigator's
        // header would sit above it as a second, emptier one.
        options={{ title: t('nav.home'), headerShown: false }}
      />
      <Tabs.Screen
        name="Services"
        component={ServicesScreen}
        options={{ title: t('nav.services') }}
      />
      <Tabs.Screen name="Outbox" component={OutboxScreen} options={{ title: t('outbox.title') }} />
      <Tabs.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile') }} />
    </Tabs.Navigator>
  )
}

/** Screens the catalogue pushes. Title keys live beside the route, once. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each screen
// reads its own params off `route`; one union across sixteen would buy nothing.
const PUSHED: { name: string; component: React.ComponentType<any>; titleKey: string }[] = [
  { name: 'Flow', component: FlowScreen, titleKey: '' },
  { name: 'Sale', component: SaleScreen, titleKey: '' },
  { name: 'Stock', component: StockScreen, titleKey: 'item.simStock' },
  { name: 'Transactions', component: TransactionsScreen, titleKey: 'item.transactions' },
  { name: 'SalesReport', component: SalesReportScreen, titleKey: 'item.salesReport' },
  { name: 'Target', component: TargetScreen, titleKey: 'item.target' },
  { name: 'Commission', component: CommissionScreen, titleKey: 'item.commission' },
  { name: 'Outstanding', component: OutstandingScreen, titleKey: 'item.outstanding' },
  { name: 'Campaigns', component: CampaignsScreen, titleKey: 'item.campaigns' },
  { name: 'Offers', component: OffersScreen, titleKey: 'item.offers' },
  {
    name: 'Notifications',
    component: NotificationsScreen,
    titleKey: 'item.notifications',
  },
  { name: 'Support', component: SupportScreen, titleKey: 'item.support' },
  {
    name: 'CustomerSearch',
    component: CustomerSearchScreen,
    titleKey: 'item.customerSearch',
  },
  { name: 'Requisition', component: RequisitionScreen, titleKey: 'item.requisition' },
  { name: 'Complaint', component: ComplaintScreen, titleKey: 'item.complaintCreate' },
  { name: 'Wallet', component: WalletScreen, titleKey: 'item.wallet' },
]

export function RootNavigator() {
  const { t } = useTranslation()
  const { colors, theme } = useTheme()
  const { status } = useAuth()

  /**
   * React Navigation paints the screen background itself, underneath our
   * views. Left at its own default the app flashes white on every push in dark
   * mode, so the container theme is derived from ours rather than picked from
   * their two presets.
   */
  const navTheme: NavTheme = {
    dark: theme === 'dark',
    colors: {
      primary: colors.brand,
      background: colors.paper,
      card: colors.surface,
      text: colors.ink,
      border: colors.ruleSoft,
      notification: colors.danger,
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' },
      medium: { fontFamily: 'System', fontWeight: '600' },
      bold: { fontFamily: 'System', fontWeight: '700' },
      heavy: { fontFamily: 'System', fontWeight: '800' },
    },
  }

  const titleFor = useCallback(
    (key: string) => (key ? t(key) : undefined),
    [t],
  )

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.ink,
          headerRight: () => <HeaderControls />,
        }}
      >
        {status !== 'authenticated' ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            {PUSHED.map((screen) => (
              <Stack.Screen
                key={screen.name}
                name={screen.name}
                component={screen.component}
                // A flow sets its own title from the spec it was handed, so it
                // reads "New SIM activation" rather than "Flow".
                options={{ title: titleFor(screen.titleKey) }}
              />
            ))}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  )
}
