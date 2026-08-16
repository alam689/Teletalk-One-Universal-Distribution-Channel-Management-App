const app = require('./app.json')

/**
 * Dynamic config, and it exists for exactly one reason: **GitHub Pages serves
 * this app from a sub-path**, not from the root of a domain.
 *
 *   https://alam689.github.io/Teletalk-One-Universal-Distribution-Channel-Management-App/
 *
 * Expo's web export writes absolute asset URLs (`/_expo/static/...`). Served
 * from a sub-path those all 404, and the page loads as a white screen with no
 * error a non-developer could act on. `experiments.baseUrl` prefixes them.
 *
 * It is applied **only when `EXPO_PUBLIC_BASE_URL` is set**, which the Pages
 * workflow does and nothing else does. Baking it into `app.json` would break
 * `npm start` locally and every native build, because a native bundle has no
 * base path at all — it reads assets off the device.
 */
const baseUrl = (process.env.EXPO_PUBLIC_BASE_URL ?? '').replace(/\/+$/, '')

module.exports = {
  ...app.expo,
  experiments: {
    ...(app.expo.experiments ?? {}),
    ...(baseUrl ? { baseUrl } : {}),
  },
}
