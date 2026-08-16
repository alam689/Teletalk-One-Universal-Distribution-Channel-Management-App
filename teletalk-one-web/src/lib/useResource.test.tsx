import { describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { ApiError } from './http'
import { useResource } from './useResource'

describe('useResource', () => {
  it('exposes the payload once it lands', async () => {
    const { result } = renderHook(() => useResource('k', async () => 'value'))

    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.data).toBe('value'))
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('turns a failure into the remedy key the server named', async () => {
    const { result } = renderHook(() =>
      useResource('k', () => Promise.reject(new ApiError('notFound', 404, 'posUnknown'))),
    )

    await waitFor(() => expect(result.current.error).toBe('error.posUnknown'))
    expect(result.current.loading).toBe(false)
  })

  it('reload tries again — every one of these screens is reachable offline', async () => {
    let attempt = 0
    const { result } = renderHook(() =>
      useResource('k', () => {
        attempt += 1
        return attempt === 1
          ? Promise.reject(new ApiError('network'))
          : Promise.resolve('recovered')
      }),
    )

    await waitFor(() => expect(result.current.error).toBe('error.network'))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.data).toBe('recovered'))
    expect(result.current.error).toBeNull()
  })

  it('a slow response for an old key never overwrites the current screen', async () => {
    // The failure this hook exists to prevent: a retailer taps through the
    // catalogue and the slowest request lands last, on a screen it is not for.
    const fetcher = vi.fn((key: string, _signal: AbortSignal) =>
      key === 'slow'
        ? new Promise<string>((resolve) => setTimeout(() => resolve('slow-data'), 40))
        : Promise.resolve('fast-data'),
    )

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useResource(key, (signal) => fetcher(key, signal)),
      { initialProps: { key: 'slow' } },
    )

    rerender({ key: 'fast' })
    await waitFor(() => expect(result.current.data).toBe('fast-data'))

    await new Promise((r) => setTimeout(r, 60))
    expect(result.current.data).toBe('fast-data')
  })
})
