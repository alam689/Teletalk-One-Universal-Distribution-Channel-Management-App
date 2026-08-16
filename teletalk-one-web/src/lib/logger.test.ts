import { describe, expect, it, vi } from 'vitest'
import { logger, scrub, setCrashReporter, type CrashReport } from './logger'

/**
 * A crash report leaves the device, so what it carries is a disclosure
 * decision rather than a formatting one.
 */

describe('scrub', () => {
  it('removes every shape of identifier this app handles', () => {
    expect(scrub('activation failed for 01712345678')).toBe('activation failed for [msisdn]')
    expect(scrub('nid 1234567890 rejected')).toBe('nid [nid] rejected')
    expect(scrub('legacy nid 9876543210123')).toBe('legacy nid [nid]')
    expect(scrub('17-digit 19911234567890123')).toBe('17-digit [nid]')
  })

  it('takes the longest identifier first, so an NID is not mangled as an MSISDN', () => {
    // 19911234567890123 starts with a run that looks like nothing in
    // particular; the danger is a 13-digit value being eaten as 11 + 2.
    expect(scrub('9876543210123')).toBe('[nid]')
    expect(scrub('9876543210123').includes('123')).toBe(false)
  })

  it('leaves things that are not identifiers alone', () => {
    expect(scrub('amount 500 at 12:40')).toBe('amount 500 at 12:40')
    expect(scrub('ACT20260001')).toBe('ACT20260001')
  })
})

describe('logger.error', () => {
  it('scrubs the message, the error and the extra before reporting', () => {
    const reports: CrashReport[] = []
    setCrashReporter((r) => reports.push(r))

    logger.error('failed for 01712345678', new Error('nid 1234567890 not found'), {
      nested: { msisdn: '01598877665' },
    })

    expect(reports).toHaveLength(1)
    const [report] = reports
    expect(report.message).toBe('failed for [msisdn]')
    expect(JSON.stringify(report.error)).toContain('[nid]')
    expect(JSON.stringify(report.extra)).toContain('[msisdn]')
    expect(JSON.stringify(report)).not.toContain('01712345678')
    setCrashReporter(null)
  })

  it('never lets a broken reporter take the app down', () => {
    setCrashReporter(() => {
      throw new Error('the reporter itself is on fire')
    })
    expect(() => logger.error('something')).not.toThrow()
    setCrashReporter(null)
  })

  it('reports nothing at all until a reporter is attached', () => {
    const spy = vi.fn()
    setCrashReporter(null)
    logger.error('unreported')
    expect(spy).not.toHaveBeenCalled()
  })
})
