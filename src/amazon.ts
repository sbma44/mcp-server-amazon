import * as cheerio from 'cheerio'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { USE_MOCKS, EXPORT_LIVE_SCRAPING_FOR_MOCKS } from './config.js'
import { createBrowserAndPage, getTimestamp } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

export async function getOrdersHistory() {
  let html: string
  if (USE_MOCKS) {
    console.error('[INFO] Fetching orders history from mocks')
    const mockPath = `${__dirname}/../mocks/getOrdersHistory.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = 'https://www.amazon.es/-/en/gp/css/order-history'
    console.error(`[INFO] Fetching orders history from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export the current page content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getOrdersHistory_${timestamp}.html`
        html = await page.content()
        fs.writeFileSync(mockPath, html)
        console.error(`[INFO] Exported live scraping HTML to ${mockPath}`)
      }

      // Wait for the order cards to load (adjust selector as needed)
      try {
        await page.waitForSelector('.order-card, .your-orders-content-container', { timeout: 10000 })
      } catch (e) {
        console.error('[INFO] Order cards not found immediately, proceeding with current content')
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  // if (!USE_MOCKS) console.error('[INFO] Fetched orders history HTML', html)

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

async function throwIfNotLoggedIn(page: puppeteer.Page): Promise<void> {
  const isLoginPage = (await page.$('#ap_email')) !== null || (await page.$('#signInSubmit')) !== null
  if (isLoginPage) {
    throw new Error('You need to be logged in to access this feature. Please log in to Amazon first and then try again.')
  }
}

interface CartItem {
  title: string
  price: string
  quantity: number
  image?: string
  productUrl?: string
  asin?: string
  availability: string
  isSelected: boolean
}

interface CartContent {
  isEmpty: boolean
  items: CartItem[]
  subtotal?: string
  totalItems?: number
}

export async function getCartContent(): Promise<CartContent> {
  let html: string
  if (USE_MOCKS) {
    console.error('[INFO] Fetching cart content from mocks')
    const mockPath = `${__dirname}/../mocks/getCartContent.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = 'https://www.amazon.es/-/en/gp/cart/view.html?ref_=nav_cart'
    console.error(`[INFO] Fetching cart content from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the cart page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export the current page content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getCartContent_${timestamp}.html`
        html = await page.content()
        fs.writeFileSync(mockPath, html)
        console.error(`[INFO] Exported live scraping HTML to ${mockPath}`)
      }

      // Wait for the cart content to load
      try {
        await page.waitForSelector('#sc-active-cart', { timeout: 10000 })
      } catch (e) {
        console.error('[INFO] Cart container not found immediately, proceeding with current content')
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  return extractCartData($)
}

function extractCartData($: cheerio.CheerioAPI): CartContent {
  const $cartContainer = $('#sc-active-cart')

  // Check if cart is empty
  const emptyCartText = $cartContainer.text()
  if (emptyCartText.includes('Your Amazon Cart is empty')) {
    return {
      isEmpty: true,
      items: [],
    }
  }

  // Extract cart items
  const items: CartItem[] = []
  $cartContainer.find('[data-asin]').each((index, element) => {
    const $item = $(element)

    // Extract basic item information
    const titleElement = $item.find('a.sc-product-title').first()
    const title = titleElement.find('.a-truncate-full').text().trim()
    const price = $item.find('.apex-price-to-pay-value .a-offscreen').text().trim()
    const quantityElement = $item.find('[data-a-selector="value"]').text().trim()
    const quantity = parseInt(quantityElement) || 1

    // Extract optional information
    const image = $item.find('.sc-product-image').attr('src')
    const productUrl = $item.find('.sc-product-link').attr('href')
    const asin = $item.attr('data-asin')
    const availability = $item.find('.sc-product-availability').text().trim() || 'Unknown'
    const isSelected = $item.find('input[type="checkbox"]').is(':checked')

    console.error(`[INFO] Extracted item: ${title}, Price: ${price}, Quantity: ${quantity}, ASIN: ${asin}`)
    // Only add items with valid titles and prices
    if (title && price) {
      items.push({
        title,
        price,
        quantity,
        image,
        productUrl,
        asin,
        availability,
        isSelected,
      })
    }
  })

  // Extract subtotal information
  const subtotal =
    $cartContainer.find('#sc-subtotal-amount-activecart .sc-price').text().trim() ||
    $cartContainer.find('.sc-subtotal .sc-price').text().trim()

  const totalItemsText = $cartContainer.find('#sc-subtotal-label-activecart').text().trim()
  const totalItemsMatch = totalItemsText.match(/\((\d+)\s+item/)
  const totalItems = totalItemsMatch ? parseInt(totalItemsMatch[1]) : items.length

  return {
    isEmpty: false,
    items,
    subtotal,
    totalItems,
  }
}
