import { useMemo, useState } from 'react'
import { Pressable, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { EmptyState, Field, Screen, SectionHead, Text } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { useTheme } from '../../theme/ThemeProvider'
import { useAuth } from '../auth/AuthProvider'
import { menuFor, type Destination } from './menu'

/**
 * Everything this outlet can do, grouped.
 *
 * The search box is not decoration. A retailer who knows they want "port in"
 * should not have to remember whether it lives under MNP or under SIM — and
 * the two-word Bangla labels are close enough to each other that scanning is
 * genuinely slower than typing three characters.
 */
export function ServicesScreen() {
  const { t } = useTranslation()
  const { colors, space, radius, category } = useTheme()
  const navigation = useNavigation<{ navigate: (screen: string, params?: object) => void }>()
  const { can } = useAuth()
  const [query, setQuery] = useState('')

  const groups = useMemo(() => menuFor(can), [can])

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return groups
    return groups
      .map((group) => ({
        id: group.id,
        items: group.items.filter((item) =>
          t(`item.${item.id}`).toLowerCase().includes(needle),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, query, t])

  const count = filtered.reduce((n, group) => n + group.items.length, 0)
  const go = (to: Destination) => navigation.navigate(to.screen, to.id ? { id: to.id } : undefined)

  return (
    <Screen>
      <Field
        label={t('nav.services')}
        value={query}
        onChangeText={setQuery}
        placeholder={t('home.searchPlaceholder')}
        autoCorrect={false}
        returnKeyType="search"
      />

      {query.trim() ? (
        <Text variant="caption" tone="muted">
          {t('home.resultCount', { count })}
        </Text>
      ) : null}

      {count === 0 ? (
        <EmptyState icon="search" title={t('home.noMatch', { query: query.trim() })} />
      ) : null}

      {filtered.map((group) => (
        <View key={group.id} style={{ gap: space.s3 }}>
          <SectionHead title={t(`group.${group.id}`)} />
          <View style={{ gap: space.s2 }}>
            {group.items.map((item) => {
              const tint = category(item.category)
              return (
                <Pressable
                  key={item.id}
                  onPress={() => go(item.to)}
                  accessibilityRole="button"
                  accessibilityLabel={t(`item.${item.id}`)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.s3,
                    minHeight: 56,
                    padding: space.s3,
                    borderRadius: radius.base,
                    backgroundColor: pressed ? colors.surface2 : colors.surface,
                    borderWidth: 1,
                    borderColor: colors.ruleSoft,
                  })}
                >
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: tint.well,
                    }}
                  >
                    <Icon name={item.icon} size={21} color={tint.ink} />
                  </View>
                  <Text variant="body" weight="600" style={{ flex: 1 }}>
                    {t(`item.${item.id}`)}
                  </Text>
                  <Icon name="chevron" size={16} color={colors.muted} />
                </Pressable>
              )
            })}
          </View>
        </View>
      ))}
    </Screen>
  )
}
