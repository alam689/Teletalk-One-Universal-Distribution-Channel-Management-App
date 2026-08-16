import { logger } from './logger'

/**
 * A single location fix, with the two things that make it usable as evidence:
 * an accuracy figure, and a timeout.
 *
 * **The scope call recorded here:** there is no map in this application. A
 * mapping library is 150 kB of JavaScript plus tiles fetched from a third-party
 * host, and this app is built for a 2G counter phone with a strict
 * no-external-request policy. So a location is a coordinate pair, an accuracy
 * radius and a distance — numbers a field officer can read and a server can
 * check. If a visual map turns out to be necessary, it is a deliberate
 * decision with a bundle cost attached, not a component swap.
 */

export interface GeoFix {
  lat: number
  lng: number
  /** Metres. The browser's own confidence, and it is often terrible indoors. */
  accuracy: number
}

/** `error.*` key, so a refusal reads like every other failure in the app. */
export type GeoErrorKey =
  | 'error.geoUnsupported'
  | 'error.geoDenied'
  | 'error.geoUnavailable'
  | 'error.geoTimeout'

export class GeoError extends Error {
  constructor(public key: GeoErrorKey) {
    super(key)
    this.name = 'GeoError'
  }
}

/**
 * A fix taken indoors behind a shutter can be a kilometre out, so the caller
 * is given the accuracy rather than a boolean, and decides for itself whether
 * it is good enough to record.
 */
export const ACCEPTABLE_ACCURACY_METRES = 100

export function captureLocation(timeoutMs = 15_000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new GeoError('error.geoUnsupported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }),
      (error) => {
        logger.warn('location capture failed', { code: error.code })
        if (error.code === error.PERMISSION_DENIED) reject(new GeoError('error.geoDenied'))
        else if (error.code === error.TIMEOUT) reject(new GeoError('error.geoTimeout'))
        else reject(new GeoError('error.geoUnavailable'))
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    )
  })
}

const EARTH_RADIUS_METRES = 6_371_000

/** Great-circle distance. Good to well under a metre at these ranges. */
export function distanceMetres(a: GeoFix, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return Math.round(2 * EARTH_RADIUS_METRES * Math.asin(Math.sqrt(h)))
}

/** Six decimal places is about 0.1 m — more is false precision. */
export function formatCoordinate(value: number): string {
  return value.toFixed(6)
}
