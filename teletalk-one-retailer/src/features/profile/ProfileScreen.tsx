import { View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { Button, Card, DataRow, Pill, Screen, SectionHead, Text } from '../../components/ui'
import { Icon } from '../../components/Icon'
import { useTheme } from '../../theme/ThemeProvider'
import { applyLang } from '../../i18n'
import { formatDate, formatQuantity, type Lang } from '../../i18n/format'
import { env } from '../../env'
import { useAuth, useSession } from '../auth/AuthProvider'
import { useUnsettledCount } from '../outbox/OutboxBanner'

/**
 * The outlet, and the two switches.
 *
 * Sign-out is the only destructive control in the app, and it is guarded by
 * what is above it rather than by a dialog: if anything is still queued, the
 * count is on the screen in the danger tone before the button is reachable.
 * Signing out clears the queue — nothing in it has reached the server — so the
 * retailer has to be told, not asked to remember.
 */
export function ProfileScreen() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as Lang
  const { colors, space, theme, toggle } = useTheme()
  const { signOut } = useAuth()
  const session = useSession()
  const pending = useUnsettledCount()

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.brandWash,
            }}
          >
            <Icon name="store" size={26} color={colors.brand} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text variant="heading" weight="700">
              {session.name[lang]}
            </Text>
            <Text variant="caption" tone="muted" identifier>
              BD {session.posCode}
            </Text>
          </View>
          {session.tier ? <Pill tone="brand" label={t(`tier.${session.tier}`)} /> : null}
        </View>

        <DataRow label={t('profile.owner')} value={session.ownerName[lang]} />
        <DataRow label={t('profile.msisdn')} value={session.msisdn} identifier />
        <DataRow label={t('profile.role')} value={t(`role.${session.role}`)} />
        <DataRow label={t('profile.zone')} value={session.zone[lang]} />
        <DataRow label={t('profile.territory')} value={session.territory[lang]} />
        <DataRow label={t('profile.address')} value={session.outletAddress[lang]} />
        <DataRow label={t('profile.enlisted')} value={formatDate(session.enlistedOn, lang)} />
      </Card>

      <Card>
        <SectionHead title={t('profile.security')} />
        <DataRow
          label={t('profile.passwordUpdated')}
          value={formatDate(session.passwordUpdatedOn, lang)}
        />
        <DataRow
          label={t('profile.deviceTrusted')}
          value={t(session.deviceTrusted ? 'profile.deviceTrusted' : 'profile.deviceNotTrusted')}
        />
        <DataRow
          label={t('profile.capabilities')}
          value={t('profile.capabilityCount', { count: session.capabilities.length })}
        />
        <Text variant="caption" tone="muted">
          {t('profile.editNote')}
        </Text>
      </Card>

      <Card>
        <SectionHead title={t('nav.account')} />
        {/* The same two symbols the header carries, spelled out here. The
            header is for the retailer who already knows; this is for the one
            who is looking for the setting. */}
        <Button
          label={t('lang.switchTo')}
          icon="globe"
          variant="secondary"
          onPress={() => void applyLang(lang === 'bn' ? 'en' : 'bn')}
        />
        <Button
          label={theme === 'dark' ? t('theme.toLight') : t('theme.toDark')}
          icon={theme === 'dark' ? 'sun' : 'moon'}
          variant="secondary"
          onPress={toggle}
        />
      </Card>

      <Card>
        {pending > 0 ? (
          <Text variant="small" tone="danger">
            {t('outbox.signOutWarning', { count: pending })}
          </Text>
        ) : null}
        <Button
          label={t('login.signOut')}
          icon="logout"
          variant="danger"
          onPress={() => void signOut()}
        />
      </Card>

      {/* Build facts, in development only. A retailer never needs these; the
          person debugging a handset in a zonal office needs all of them. */}
      {env.isDev ? (
        <Card>
          <DataRow label="API" value={env.useMockApi ? 'mock' : env.apiBaseUrl} />
          <DataRow
            label="Idle timeout"
            value={`${formatQuantity(env.idleTimeoutMs / 60000, lang)} min`}
          />
        </Card>
      ) : null}
    </Screen>
  )
}
