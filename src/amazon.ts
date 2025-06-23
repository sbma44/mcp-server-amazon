import * as cheerio from 'cheerio'
import fs from 'fs'
import puppeteer from 'puppeteer'
import { USE_MOCKS, EXPORT_LIVE_SCRAPING_FOR_MOCKS } from './config.js'
import { createBrowserAndPage, getTimestamp } from './utils.js'

const __dirname = new URL('.', import.meta.url).pathname

async function throwIfNotLoggedIn(page: puppeteer.Page): Promise<void> {
  const isLoginPage = (await page.$('#ap_email')) !== null || (await page.$('#signInSubmit')) !== null
  if (isLoginPage) {
    throw new Error('You need to be logged in to access this feature. Please log in to Amazon first and then try again.')
  }
}

// ##################################
// Start getOrdersHistory
// ##################################

export async function getOrdersHistory() {
  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][get-orders-history] Fetching orders history from mocks')
    const mockPath = `${__dirname}/../mocks/getOrdersHistory.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = 'https://www.amazon.es/-/en/gp/css/order-history'
    console.error(`[INFO][get-orders-history] Fetching orders history from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for the order cards to load (adjust selector as needed)
      try {
        await page.waitForSelector('.order-card, .your-orders-content-container', { timeout: 10000 })
      } catch (e) {
        throw new Error(
          '[INFO][get-orders-history] Could not find orders card selector. Ensure you are logged in and the orders history is accessible.'
        )
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export only the .order-card and .your-orders-content-container content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getOrdersHistory_${timestamp}.html`
        const orderCardsHtml = await page.$$eval('.order-card, .your-orders-content-container', elements =>
          elements.map(el => el.outerHTML).join('\n')
        )
        fs.writeFileSync(mockPath, orderCardsHtml)
        console.error(`[INFO][get-orders-history] Exported order cards HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

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

// ##################################
// End getOrdersHistory
// ##################################

// ##################################
// Start getCartContent
// ##################################

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
    console.error('[INFO][get-cart-content] Fetching cart content from mocks')
    const mockPath = `${__dirname}/../mocks/getCartContent.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = 'https://www.amazon.es/-/en/gp/cart/view.html?ref_=nav_cart'
    console.error(`[INFO][get-cart-content] Fetching cart content from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the cart page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for the cart content to load
      try {
        await page.waitForSelector('#sc-active-cart', { timeout: 10000 })
      } catch (e) {
        throw new Error('[INFO][get-cart-content] Could not find cart container. Ensure you are logged in and the cart is accessible.')
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export only the `#sc-active-cart` content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getCartContent_${timestamp}.html`
        const cartHtml = await page.$eval('#sc-active-cart', el => el.outerHTML)
        fs.writeFileSync(mockPath, cartHtml)
        console.error(`[INFO][get-cart-content] Exported cart container HTML to ${mockPath}`)
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

    console.error(`[INFO][get-cart-content] Extracted ASIN: ${asin}, Price: ${price}, Quantity: ${quantity}, item: ${title}`)
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

// ##################################
// End getCartContent
// ##################################

// ##################################
// Start addToCart
// ##################################

export async function addToCart(asin: string): Promise<{ success: boolean; message: string }> {
  if (!asin || asin.length !== 10) {
    throw new Error('Invalid ASIN provided. ASIN should be a 10-character string.')
  }

  const url = `https://www.amazon.es/-/en/gp/product/${asin}`
  console.error(`[INFO][add-to-cart] Adding product ${asin} to cart from ${url}`)

  const { browser, page } = await createBrowserAndPage()

  try {
    // Navigate to the product page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Handle login if needed
    await throwIfNotLoggedIn(page)

    // Wait for the page to load completely
    await page.waitForSelector('body', { timeout: 10000 })

    try {
      // Check for subscribe and save option using XPath
      const xpath = "//div[contains(@class, 'accordion-caption')]//span[contains(text(), 'One-time purchase')]"
      const element = await page.waitForSelector(`::-p-xpath(${xpath})`, { timeout: 2000 })
      if (element) {
        console.error(`[INFO][add-to-cart] The item is a subscribe and save product, clicking the one-time purchase option`)
        element.click()
        // Wait for the page to update
        await new Promise(resolve => setTimeout(resolve, 2000))
      } else {
        console.error('[INFO][add-to-cart] No subscribe and save option found, proceeding to add to cart')
      }
    } catch (error) {
      throw new Error(`Error checking for subscribe and save option: ${error}`)
    }

    // Find and click the add to cart button
    try {
      await page.waitForSelector('#add-to-cart-button', { timeout: 10000 })
      await page.click('#add-to-cart-button')
      console.error('[INFO][add-to-cart] Clicked add to cart button')
    } catch (error) {
      throw new Error(`Could not find or click the add to cart button: ${error}`)
    }

    // Wait for the confirmation page/modal
    try {
      await page.waitForSelector('#sw-atc-confirmation', { timeout: 15000 })

      // Check for success message
      const confirmationText = await page.$eval('#sw-atc-confirmation', el => el.textContent || '')

      if (!confirmationText.includes('Added to basket')) {
        throw new Error(`Unexpected confirmation message: ${confirmationText}`)
      }

      console.error('[INFO][add-to-cart] Successfully added product to cart')
      return {
        success: true,
        message: `Product ${asin} successfully added to cart`,
      }
    } catch (error) {
      throw new Error(`Could not verify that the product was added to cart: ${error}`)
    }
  } finally {
    await browser.close()
  }
}

// ##################################
// End addToCart
// ##################################
