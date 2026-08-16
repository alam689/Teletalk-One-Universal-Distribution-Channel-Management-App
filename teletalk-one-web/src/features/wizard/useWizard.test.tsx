import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from '../../lib/http'
import { readDraft } from './draft'
import { useWizard } from './useWizard'
import type { FieldErrors, WizardConfig, WizardStep } from './types'

/**
 * The engine's contract, pinned. Every case here is a property the activation
 * flow depends on but cannot test cheaply through the UI.
 */

interface Demo {
  a: string
  b: string
  secret: string
}

const EMPTY: Demo = { a: '', b: '', secret: '' }

function config(overrides: Partial<WizardConfig<Demo>> = {}): WizardConfig<Demo> {
  const steps: WizardStep<Demo>[] = [
    {
      id: 'one',
      labelKey: 'one',
      validate: (d): FieldErrors => (d.a ? {} : { a: 'error.aRequired' }),
      render: () => null,
    },
    { id: 'two', labelKey: 'two', render: () => null },
    { id: 'three', labelKey: 'three', terminal: true, render: () => null },
  ]
  return {
    id: 'demo',
    version: 1,
    titleKey: 'demo',
    initialData: EMPTY,
    steps,
    ...overrides,
  }
}

describe('useWizard — step gating', () => {
  it('refuses to advance while the step is invalid, and says which field', () => {
    const { result } = renderHook(() => useWizard(config()))

    act(() => result.current.next())

    expect(result.current.step.id).toBe('one')
    expect(result.current.errors.a).toBe('error.aRequired')
  })

  it('clears a field error the moment the field is corrected', () => {
    const { result } = renderHook(() => useWizard(config()))

    act(() => result.current.next())
    expect(result.current.errors.a).toBeDefined()

    act(() => result.current.update({ a: 'filled' }))
    expect(result.current.errors.a).toBeUndefined()
  })

  it('advances once the step validates', () => {
    const { result } = renderHook(() => useWizard(config()))

    act(() => result.current.update({ a: 'filled' }))
    act(() => result.current.next())

    expect(result.current.step.id).toBe('two')
    expect(result.current.index).toBe(1)
  })
})

describe('useWizard — commits', () => {
  it('merges the commit’s patch into the draft and then advances', async () => {
    const steps = config().steps
    steps[0].commit = () => Promise.resolve({ b: 'from-server' })
    const { result } = renderHook(() => useWizard(config({ steps })))

    act(() => result.current.update({ a: 'filled' }))
    act(() => result.current.next())

    await waitFor(() => expect(result.current.step.id).toBe('two'))
    expect(result.current.data.b).toBe('from-server')
  })

  it('stays on the step when the commit is refused, and keeps what was typed', async () => {
    const steps = config().steps
    steps[0].commit = () => Promise.reject(new ApiError('conflict', 409, 'nidDobMismatch'))
    const { result } = renderHook(() => useWizard(config({ steps })))

    act(() => result.current.update({ a: 'filled' }))
    act(() => result.current.next())

    await waitFor(() => expect(result.current.commitError).toBe('error.nidDobMismatch'))
    expect(result.current.step.id).toBe('one')
    expect(result.current.data.a).toBe('filled')
    expect(result.current.busy).toBe(false)
  })

  it('does not fire the commit twice while one is in flight', async () => {
    const commit = vi.fn(() => new Promise<void>((r) => setTimeout(r, 20)))
    const steps = config().steps
    steps[0].commit = commit
    const { result } = renderHook(() => useWizard(config({ steps })))

    act(() => result.current.update({ a: 'filled' }))
    act(() => {
      result.current.next()
      result.current.next()
    })

    await waitFor(() => expect(result.current.step.id).toBe('two'))
    expect(commit).toHaveBeenCalledTimes(1)
  })
})

describe('useWizard — resuming', () => {
  it('picks the draft back up at the step it was left on', () => {
    const first = renderHook(() => useWizard(config()))
    act(() => first.result.current.update({ a: 'filled' }))
    act(() => first.result.current.next())
    first.unmount()

    // A reload mid-flow: same config, brand new mount.
    const second = renderHook(() => useWizard(config()))
    expect(second.result.current.resumed).toBe(true)
    expect(second.result.current.step.id).toBe('two')
    expect(second.result.current.data.a).toBe('filled')
  })

  it('does not write a draft before anything has been entered', () => {
    renderHook(() => useWizard(config()))
    expect(readDraft('demo', 1)).toBeNull()
  })

  it('discards a draft written against an older data shape', () => {
    const first = renderHook(() => useWizard(config()))
    act(() => first.result.current.update({ a: 'filled' }))
    first.unmount()

    const second = renderHook(() => useWizard(config({ version: 2 })))
    expect(second.result.current.resumed).toBe(false)
    expect(second.result.current.data.a).toBe('')
  })

  it('never persists a redacted field', () => {
    const { result } = renderHook(() => useWizard(config({ redact: ['secret'] })))
    act(() => result.current.update({ a: 'filled', secret: 'fingerprint-template' }))

    const draft = readDraft<Demo>('demo', 1)
    expect(draft?.data.a).toBe('filled')
    expect(draft?.data.secret).toBeUndefined()
    // …but it is still usable in this session, which is the point.
    expect(result.current.data.secret).toBe('fingerprint-template')
  })

  it('abandon clears the draft and returns to step one', () => {
    const { result } = renderHook(() => useWizard(config()))
    act(() => result.current.update({ a: 'filled' }))
    act(() => result.current.next())

    act(() => result.current.abandon())

    expect(result.current.step.id).toBe('one')
    expect(result.current.data.a).toBe('')
    expect(readDraft('demo', 1)).toBeNull()
  })
})

describe('useWizard — leaving', () => {
  it('is free to leave until something is entered, then asks', () => {
    const { result } = renderHook(() => useWizard(config()))
    expect(result.current.leavePolicy).toBe('free')

    act(() => result.current.update({ a: 'filled' }))
    expect(result.current.leavePolicy).toBe('confirm')
  })

  it('refuses to go back out of a step that declares itself blocked', () => {
    const steps = config().steps
    steps[1].leave = () => 'blocked'
    const { result } = renderHook(() => useWizard(config({ steps })))

    act(() => result.current.update({ a: 'filled' }))
    act(() => result.current.next())
    expect(result.current.step.id).toBe('two')

    act(() => result.current.back())
    expect(result.current.step.id).toBe('two')
  })
})

describe('useWizard — optional steps', () => {
  it('skips a step whose config disables it', () => {
    const steps = config().steps
    steps[1].enabled = (d) => d.b === 'yes'
    const { result } = renderHook(() => useWizard(config({ steps })))

    expect(result.current.steps.map((s) => s.id)).toEqual(['one', 'three'])

    act(() => result.current.update({ a: 'filled' }))
    act(() => result.current.next())
    expect(result.current.step.id).toBe('three')
  })
})
