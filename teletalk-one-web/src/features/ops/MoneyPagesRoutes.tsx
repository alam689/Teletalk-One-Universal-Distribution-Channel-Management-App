import { PaymentCollectPage, SettlementPage, SubsidyPage, WalletPage } from './MoneyPages'

/**
 * Route entry for the four money screens.
 *
 * They live in one module because they are four views of the same question,
 * but `lazy()` needs a default export per chunk — so this file is the seam,
 * and it is deliberately the only thing in it.
 */
export default function MoneyPagesRoutes({
  screen,
}: {
  screen: 'wallet' | 'collect' | 'settlement' | 'subsidy'
}) {
  if (screen === 'wallet') return <WalletPage />
  if (screen === 'collect') return <PaymentCollectPage />
  if (screen === 'settlement') return <SettlementPage />
  return <SubsidyPage />
}
