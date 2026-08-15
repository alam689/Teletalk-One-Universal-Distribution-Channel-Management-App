import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '../lib/logger'

interface State {
  error: Error | null
}

/**
 * Last line of defence. A render crash on a retailer counter must not leave a
 * blank white screen with no way forward — this always offers a reload.
 *
 * Copy is intentionally bilingual and static: the boundary can catch a failure
 * inside i18n itself, so it cannot depend on translation being available.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logger.error('render crash', error, { componentStack: info.componentStack })
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children

    return (
      <div className="crash" role="alert">
        <div className="crash__card">
          <h1 className="crash__title">কিছু একটা সমস্যা হয়েছে</h1>
          <p className="crash__body">
            অ্যাপটি চালু রাখা যায়নি। পেজটি আবার লোড করুন। সমস্যা থাকলে হেল্পলাইন ১২১-এ
            যোগাযোগ করুন।
          </p>
          <p className="crash__body crash__body--en" lang="en">
            Something went wrong. Reload the page, and call helpline 121 if it keeps happening.
          </p>
          <button type="button" className="crash__btn" onClick={() => window.location.reload()}>
            আবার লোড করুন / Reload
          </button>
        </div>
      </div>
    )
  }
}
