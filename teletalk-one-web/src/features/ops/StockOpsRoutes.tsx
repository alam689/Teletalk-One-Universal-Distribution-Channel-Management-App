import { StockMovementPage, StockReconcilePage } from './StockOpsPages'

/** Route entry for the three stock-movement screens. */
export default function StockOpsRoutes({
  screen,
}: {
  screen: 'return' | 'transfer' | 'reconcile'
}) {
  if (screen === 'reconcile') return <StockReconcilePage />
  return <StockMovementPage kind={screen} />
}
