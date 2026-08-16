import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { applyLang } from '../../i18n'
import { renderWithProviders } from '../../test/renderApp'
import FlowPage from './FlowPage'
import MnpStatusPage from './MnpStatusPage'
import ChoiceNumberPage from './ChoiceNumberPage'
import { FLOW_SPECS } from './flowSpec'

/**
 * The FE-1.1 headline, end to end through the real screens: a retailer
 * activates a SIM and completes the customer's first recharge **on one login**,
 * against the 30–40 minutes it takes today across BVS and Telepay.
 */

const SIM_SERIAL = '8988015123456789012'
const NID = '1234567890'
const DOB = '1994-03-17'

async function renderFlow(posCode: string, flowId = 'simActivate') {
  await applyLang('en')
  sessionStorage.setItem('teletalk.mock.pos', posCode)
  renderWithProviders(<FlowPage flowId={flowId} />, { route: `/services/${flowId}` })
}

const setValue = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

/** Step one: the SIM in the retailer's hand. */
async function completeSimStep() {
  await screen.findByLabelText('SIM serial (ICCID)')
  setValue('SIM serial (ICCID)', SIM_SERIAL)
  await waitFor(() => expect(screen.getByLabelText('Plan')).toHaveDisplayValue(/Choose/))
  fireEvent.change(screen.getByLabelText('Plan'), { target: { value: 'AGNI' } })
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }))
}

describe('activation — access', () => {
  it('refuses the deep link to a role without the capability', async () => {
    // A sales representative may allocate stock but never activate.
    await renderFlow('30010001')
    expect(await screen.findByText(/doesn't have permission/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('SIM serial (ICCID)')).not.toBeInTheDocument()
  })
})

describe('activation — the five-minute path', () => {
  it('activates a SIM and takes the first recharge without a second sign-in', async () => {
    await renderFlow('20060794')

    await completeSimStep()

    // Identity: NID plus date of birth, which is what fetches the EC record.
    await screen.findByLabelText('NID number')
    setValue('NID number', NID)
    setValue('Date of birth', DOB)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // e-SAF, prefilled from the national record — the retailer types the two
    // things the record cannot supply and confirms the rest with the customer.
    await screen.findByText(/filled from the Election Commission record/i, undefined, {
      timeout: 5000,
    })
    expect(screen.getByLabelText('Name (Bangla)')).toHaveValue('মোছাঃ রেহানা পারভীন')
    expect(screen.getByLabelText('District')).toHaveValue('Nilphamari')

    setValue('Contact number', '01712345678')
    await userEvent.click(screen.getByLabelText(/consents to KYC/i))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Biometric: honest about the browser, and records the BVS reference.
    await screen.findByLabelText('BVS reference')
    expect(screen.getByText(/A browser cannot read a fingerprint/i)).toBeInTheDocument()
    setValue('BVS reference', 'BVS123456')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    // Review — the NID is masked here, on a screen facing the queue.
    await screen.findByRole('heading', { name: 'Review & confirm' })
    expect(screen.getByText('••••••7890')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Activate SIM' }))

    // The transaction is queued, and is NOT reported as done until it settles.
    expect(await screen.findByText('Queued')).toBeInTheDocument()
    expect(await screen.findByText('SIM is active', undefined, { timeout: 5000 })).toBeVisible()
    expect(screen.getByText(/^ACT/)).toBeInTheDocument()

    // …and the first recharge, on the same login, without leaving the wizard.
    const fifty = await screen.findByRole('button', { name: '৳ 50.00' })
    await userEvent.click(fifty)
    await userEvent.click(screen.getByRole('button', { name: 'Recharge' }))

    expect(
      await screen.findByText(/recharged/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
  }, 30_000)
})

describe('activation — failure paths carry a remedy', () => {
  it('names the correction when the EC record is not found', async () => {
    await renderFlow('20060794')
    await completeSimStep()

    await screen.findByLabelText('NID number')
    setValue('NID number', '1234560000') // the mock's "not found" trigger
    setValue('Date of birth', DOB)
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText(/not found in the Election Commission record/i, undefined, {
        timeout: 5000,
      }),
    ).toBeInTheDocument()
    // The step is kept, with what was typed still on it.
    expect(screen.getByLabelText('NID number')).toHaveValue('1234560000')
  }, 20_000)

  it('rejects a customer under 18 before any server is called', async () => {
    await renderFlow('20060794')
    await completeSimStep()

    await screen.findByLabelText('NID number')
    setValue('NID number', NID)
    setValue('Date of birth', '2015-01-01')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(
      await screen.findByText(/cannot be registered to anyone under 18/i),
    ).toBeInTheDocument()
  }, 20_000)
})

describe('activation — leaving mid-flow', () => {
  it('asks before discarding a half-entered customer', async () => {
    await renderFlow('20060794')
    await screen.findByLabelText('SIM serial (ICCID)')
    setValue('SIM serial (ICCID)', SIM_SERIAL)

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Discard and leave?')
  })

  it('resumes at the step it was left on after a reload', async () => {
    await renderFlow('20060794')
    await completeSimStep()
    await screen.findByLabelText('NID number')

    // Same tab, fresh mount — what a reload mid-activation looks like.
    const { unmount } = renderWithProviders(<FlowPage flowId="simActivate" />)
    unmount()
    await renderFlow('20060794')

    expect(await screen.findByText(/unfinished entry has been restored/i)).toBeInTheDocument()
    expect(await screen.findByLabelText('NID number')).toBeInTheDocument()
  }, 20_000)
})

describe('MNP status', () => {
  it('reads the operator’s own reason back for a refused port', async () => {
    // MNP completes at the regulator's pace; without this screen the retailer
    // has nothing to tell a customer who comes back three days later.
    await renderFlow('20060794')
    renderWithProviders(<MnpStatusPage />)

    expect(await screen.findByText(/unpaid balance/i)).toBeInTheDocument()
    expect(screen.getByText('With the operator')).toBeInTheDocument()
  })
})

describe('port out', () => {
  it('is a spec on the same engine, with no e-SAF', () => {
    const spec = FLOW_SPECS.find((f) => f.id === 'mnpPortOut')
    expect(spec?.kind).toBe('portOut')
    // The subscriber is leaving. There is nothing to enrol.
    expect(spec?.steps).not.toContain('esaf')
    expect(spec?.steps).toContain('biometric')
  })
})

describe('choice number', () => {
  it('holds a number, and says until when', async () => {
    await renderFlow('30090001') // CSIM holds sim.choiceNumber
    renderWithProviders(<ChoiceNumberPage />)

    await userEvent.type(await screen.findByLabelText('Digits they want'), '7777')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))

    const hold = await screen.findAllByRole('button', { name: 'Hold' })
    await userEvent.click(hold[0])

    expect(
      await screen.findByText(/held for you/i, undefined, { timeout: 5000 }),
    ).toBeInTheDocument()
    expect(screen.getByText(/held until/i)).toBeInTheDocument()
  }, 20_000)

  it('refuses a pattern too short to be a request', async () => {
    await renderFlow('30090001')
    renderWithProviders(<ChoiceNumberPage />)
    await userEvent.type(await screen.findByLabelText('Digits they want'), '7')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText(/at least 2 digits/i)).toBeInTheDocument()
  }, 20_000)
})
