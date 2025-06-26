import { loadAmazonCookiesFile } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

export const IS_BROWSER_VISIBLE = true

/** Use local mock files instead of live scraping */
export const USE_MOCKS = false



export const COOKIES_FILE_PATH = `${__dirname}/../amazonCookies.json`
/**
 * Go to the Amazon website and log in to your account
 * Then export cookies as JSON using a browser extension like "Cookie-Editor"
 * and paste them in [amazonCookies.json](../amazonCookies.json)
 *
 * @see https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm?hl=fr
 */
export const AMAZON_COOKIES: {
  domain: string
  expirationDate: number
  hostOnly: boolean
  httpOnly: boolean
  name: string
  path: string
  sameSite: 'Strict' | 'Lax' | 'None' | undefined
  secure: boolean
  session: boolean
  storeId: string | null
  value: string
}[] = loadAmazonCookiesFile()
