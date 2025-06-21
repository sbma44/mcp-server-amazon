import * as cheerio from 'cheerio'
import fs from 'fs'
import puppeteer, { Page } from 'puppeteer'

const __dirname = new URL('.', import.meta.url).pathname

const USE_MOCKS = false // Set to true to use local mock file instead of live scraping

const COOKIE_FILE_PATH = `${__dirname}/../amazonCookies.json`
/**
 * Go to the Amazon website and log in to your account
 * Then export cookies as JSON using a browser extension like "Cookie-Editor"
 * and paste them in [amazonCookies.json](../amazonCookies.json)
 *
 * @see https://chromewebstore.google.com/detail/cookie-editor/hlkenndednhfkekhgcdicdfddnkalmdm?hl=fr
 */
let AMAZON_COOKIES: {
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

export async function getOrdersHistory() {
  let html: string
  if (USE_MOCKS) {
    console.log('Fetching orders history from mocks')
    const mockPath = `${__dirname}/../mocks/ordersHistory.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = 'https://www.amazon.es/-/en/gp/css/order-history'
    console.log(`Fetching orders history from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await exitIfNotLoggedIn(page)

      // Wait for the order cards to load (adjust selector as needed)
      try {
        await page.waitForSelector('.order-card, .your-orders-content-container', { timeout: 10000 })
      } catch (e) {
        console.log('Order cards not found immediately, proceeding with current content')
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  // if (!USE_MOCKS) console.log('Fetched orders history HTML', html)

  const $ = cheerio.load(html)
  const orderCards = $('.order-card')
    .map((index, element) => extractOrderData($, $(element)))
    .get()
  return orderCards
}

function extractOrderData($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>) {
  // Extract order information
  const orderNumber = $card.find('.yohtmlc-order-id span').last().text().trim()
  const orderDate = $card.find('.order-header__header-list-item').first().find('.a-size-base').text().trim()
  const total = $card.find('.order-header__header-list-item').eq(1).find('.a-size-base').text().trim()
  const status = $card.find('.delivery-box__primary-text').text().trim()
  const collectionMatch = status.match(/Collected on (.+)/)
  const collectionDate = collectionMatch ? collectionMatch[1] : null

  // Extract delivery address
  const deliveryName = $card.find('.a-popover-preload h5').text().trim()
  const deliveryAddress = $card.find('.a-popover-preload .a-row').eq(1).text().trim().replace(/\s+/g, ' ')
  const deliveryCountry = $card.find('.a-popover-preload .a-row').last().text().trim()

  // Extract items
  const items: {
    title: string
    image: string | undefined
    productUrl: string | undefined
    asin: string | null
    returnEligible: boolean
    returnDate: string | null
  }[] = []
  $card.find('.item-box').each((index, element) => {
    const $element = $(element)
    const title = $element.find('.yohtmlc-product-title a').text().trim()
    const image = $element.find('.product-image img').attr('src')
    const productUrl = $element.find('.yohtmlc-product-title a').attr('href')
    const returnText = $element.find('.a-size-small').text().trim()

    let asin = null
    if (productUrl) {
      const asinMatch = productUrl.match(/\/dp\/([A-Z0-9]{10})/)
      asin = asinMatch ? asinMatch[1] : null
    }

    let returnEligible = false
    let returnDate = null
    if (returnText.includes('Return or Replace Items')) {
      returnEligible = true
      const returnDateMatch = returnText.match(/until (.+)/)
      returnDate = returnDateMatch ? returnDateMatch[1] : null
    }

    items.push({
      title,
      image,
      productUrl,
      asin,
      returnEligible,
      returnDate,
    })
  })

  // Build final object
  return {
    orderInfo: {
      orderNumber,
      orderDate,
      total,
      deliveryAddress: {
        name: deliveryName,
        address: deliveryAddress,
        country: deliveryCountry,
      },
      status,
      collectionDate,
    },
    items,
  }
}

async function exitIfNotLoggedIn(page: Page): Promise<void> {
  // Check if we're on a login page
  const isLoginPage = (await page.$('#ap_email')) !== null || (await page.$('#signInSubmit')) !== null

  if (isLoginPage) {
    console.log('Login required. You need to be logged in to access the orders page.')
    console.log('Please log in to Amazon first and then run the script again.')
    process.exit(1)
  }
}

async function createBrowserAndPage(): Promise<{ browser: puppeteer.Browser; page: Page }> {
  // Launch Puppeteer
  const browser = await puppeteer.launch({
    headless: false, // Set to true for production
    devtools: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security', '--disable-blink-features=AutomationControlled'],
    ignoreDefaultArgs: ['--enable-automation'],
    defaultViewport: null,
  })

  // Set cookies if available
  if (AMAZON_COOKIES?.length > 0) {
    await browser.setCookie(...AMAZON_COOKIES)
    console.log('Set Amazon cookies in the browser')
  } else {
    console.log('No Amazon cookies found, proceeding without them')
  }

  const page = await browser.newPage()

  // Remove automation indicators
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', {
      get: () => undefined,
    })
  })

  // Set user agent to match real browser
  await page.setUserAgent(
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
  )

  // Set viewport
  await page.setViewport({ width: 1366, height: 768 })

  return { browser, page }
}

function loadAmazonCookiesFile() {
  if (fs.existsSync(COOKIE_FILE_PATH)) {
    try {
      const json = JSON.parse(fs.readFileSync(COOKIE_FILE_PATH, 'utf-8'))
      console.log('Loaded Amazon cookies from file')
      return json.map((cookie: any) => ({
        ...cookie,
        // Ensure sameSite is set to a valid value
        sameSite: cookie.sameSite || 'Lax',
      }))
    } catch (error: any) {
      throw new Error(`Error reading or parsing amazonCookies.json: ${error.message}`)
    }
  } else {
    throw new Error(
      `No amazonCookies.json file found at ${COOKIE_FILE_PATH}. Please create it by logging into Amazon and exporting your cookies.`
    )
  }
}

async function main() {
  try {
    const orders = await getOrdersHistory()
    console.log(JSON.stringify(orders, null, 2))
  } catch (error) {
    console.error('Error fetching orders:', error)
  }
}
main().catch(console.error)
