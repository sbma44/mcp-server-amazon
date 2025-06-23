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
    .map((index, element) => extractOrdersHistoryPageData($, $(element)))
    .get()
  return orderCards
}

function extractOrdersHistoryPageData($: cheerio.CheerioAPI, $card: cheerio.Cheerio<any>) {
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
  return extractCartPageData($)
}

function extractCartPageData($: cheerio.CheerioAPI): CartContent {
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
      console.error(`[INFO][add-to-cart] Error checking for subscribe and save option: ${error}`)
    }

    // Find and click the add to cart button
    try {
      await page.waitForSelector('#add-to-cart-button', { timeout: 10000 })
      await page.click('#add-to-cart-button')
      console.error('[INFO][add-to-cart] Clicked add to cart button')
    } catch (error) {
      throw new Error(`Could not find or click the add to cart button: ${error}`)
    }

    // If there is an insurance option, refuse it
    try {
      await page.waitForSelector('#productTitle', { timeout: 1000 })
      await page.click('#productTitle', { delay: 100 })
      await page.click('#attachSiNoCoverage', { delay: 300 })
    } catch (error) {
      console.error(`[WARNING][add-to-cart] Failed to click insurance option (it may not have been presented):`, error)
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

// ##################################
// Start clearCart
// ##################################

export async function clearCart() {
  const url = 'https://www.amazon.es/-/en/gp/cart/view.html'
  console.error(`[INFO][clear-cart] Clearing cart at ${url}`)

  const { browser, page } = await createBrowserAndPage()

  try {
    // Navigate to the cart page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

    // Handle login if needed
    await throwIfNotLoggedIn(page)

    // Wait for the cart to load
    await page.waitForSelector('#sc-active-cart, .sc-cart-item, .sc-empty-cart-banner', { timeout: 10000 })

    // Find all delete buttons
    const deleteButtons = await page.$$('span[data-action="delete-active"]')

    if (deleteButtons.length === 0) {
      console.error('[INFO][clear-cart] No items found in cart to remove')
      return {
        success: true,
        message: 'No items found in cart to remove',
        itemsRemoved: 0,
      }
    }

    console.error(`[INFO][clear-cart] Found ${deleteButtons.length} items to remove`)

    let itemsRemoved = 0

    // Click each delete button with delay
    for (let i = 0; i < deleteButtons.length; i++) {
      try {
        // Re-query the delete buttons as DOM changes after each deletion
        const currentDeleteButtons = await page.$$('span[data-action="delete-active"]')

        if (currentDeleteButtons.length === 0) {
          console.error('[INFO][clear-cart] No more items to delete')
          break
        }

        // Click the first available delete button
        await currentDeleteButtons[0].click()
        itemsRemoved++

        console.error(`[INFO][clear-cart] Removed item ${itemsRemoved}`)

        // Wait for the page to update after deletion
        if (i < deleteButtons.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800))
        }
      } catch (error) {
        console.error(`[WARNING][clear-cart] Failed to remove item ${i + 1}:`, error)
      }
    }

    console.error(`[INFO][clear-cart] Successfully removed ${itemsRemoved} items from cart`)

    return {
      success: true,
      message: `Successfully cleared cart. Removed ${itemsRemoved} items.`,
      itemsRemoved,
    }
  } catch (error: any) {
    console.error('[ERROR][clear-cart] Error clearing cart:', error)
    throw new Error(`Failed to clear cart: ${error.message}`)
  } finally {
    await browser.close()
  }
}

// ##################################
// End clearCart
// ##################################

// ##################################
// Start getProductDetails
// ##################################

interface ProductDetails {
  data: {
    asin: string
    title: string
    price: string
    canUseSubscribeAndSave: boolean
    description: {
      overview?: string
      features?: string
      facts?: string
      brandSnapshot?: string
    }
    reviews: {
      averageRating?: string
      reviewsCount?: string
    }
    mainImageUrl?: string
  }
  mainImageBase64?: string
}

export async function getProductDetails(asin: string): Promise<ProductDetails> {
  if (!asin || asin.length !== 10) {
    throw new Error('Invalid ASIN provided. ASIN should be a 10-character string.')
  }

  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][get-product-details] Fetching product details from mocks')
    const mockPath = `${__dirname}/../mocks/getProductDetails.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = `https://www.amazon.es/-/en/gp/product/${asin}`
    console.error(`[INFO][get-product-details] Fetching product details from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the product page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for the product page to load
      try {
        await page.waitForSelector('#productTitle', { timeout: 10000 })
      } catch (e) {
        throw new Error('[INFO][get-product-details] Could not find product title. The product may not exist or be accessible.')
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export the main product content to a mock file
        const timestamp = getTimestamp()
        const mockPath = `${__dirname}/../mocks/getProductDetails_${timestamp}.html`
        const productHtml = await page.content()
        fs.writeFileSync(mockPath, productHtml)
        console.error(`[INFO][get-product-details] Exported product page HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  return extractProductDetailsPageData($, asin)
}

async function extractProductDetailsPageData($: cheerio.CheerioAPI, asin: string): Promise<ProductDetails> {
  // Extract product title
  const title = $('span#productTitle').text().trim()

  // Extract price information
  let price = ''
  let canUseSubscribeAndSave: ProductDetails['data']['canUseSubscribeAndSave'] = false

  // Check if it's a subscribe and save product
  const subscriptionPrice = $('#subscriptionPrice .a-price .a-offscreen').prop('innerText')?.trim()
  if (subscriptionPrice) {
    price = subscriptionPrice
    canUseSubscribeAndSave = true
  } else {
    // Use regular price
    price = $('.priceToPay').text().trim()
  }

  // Extract description sections
  const description: ProductDetails['data']['description'] = {}

  const overview = $('#productOverview_feature_div').prop('innerText')?.trim()
  if (overview) description.overview = overview

  const features = $('#featurebullets_feature_div').prop('innerText')?.trim()
  if (features) description.features = features

  const facts = $('#productFactsDesktop_feature_div').prop('innerText')?.trim()
  if (facts) description.facts = facts

  const brandSnapshot = $('#brandSnapshot_feature_div').prop('innerText')?.trim()
  if (brandSnapshot) description.brandSnapshot = brandSnapshot

  // Extract reviews information
  const reviews: ProductDetails['data']['reviews'] = {}

  const averageRating = $('#averageCustomerReviews span.a-size-small.a-color-base').text().trim()
  if (averageRating) reviews.averageRating = averageRating

  const reviewsCountElement = $('#acrCustomerReviewLink span')
  const reviewsCount = reviewsCountElement.attr('aria-label')
  if (reviewsCount)
    reviews.reviewsCount = reviewsCount
      .replace(/\s+.*$/g, '')
      .replace(/,/g, '')
      .trim()

  // Extract main product image
  const mainImageUrl = $('#main-image-container img.a-dynamic-image').attr('src')
  // Download the image and convert to base64
  let mainImageBase64: ProductDetails['mainImageBase64'] = undefined
  if (mainImageUrl) {
    if (USE_MOCKS) {
      console.error('[INFO][get-product-details] Downloading product main image from mocks')
      const mockPath = `${__dirname}/../mocks/getProductDetails_image_base64.txt`
      mainImageBase64 = fs.readFileSync(mockPath, 'utf-8')
    } else {
      // FIXME: This is not supported yet by Claude Desktop client!! Uncomment when they implement it
      // console.error(`[INFO][get-product-details] Downloading main image from ${mainImageUrl}`)
      // mainImageBase64 = await downloadImageAsBase64(mainImageUrl)
      // if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
      //   const timestamp = getTimestamp()
      //   const mockPath = `${__dirname}/../mocks/getProductDetails_image_base64_${timestamp}.txt`
      //   fs.writeFileSync(mockPath, mainImageBase64)
      //   console.error(`[INFO][get-product-details] Exported main image base64 to ${mockPath}`)
      // }
    }
  }

  console.error(
    `[INFO][get-product-details] Extracted product: ASIN: ${asin}, ${title}, Price: ${price}, Can use subscribe and save: ${canUseSubscribeAndSave}, Reviews: ${reviews.averageRating} (${reviews.reviewsCount} reviews), Main image URL: ${mainImageUrl}`
  )

  return {
    data: {
      asin,
      title,
      price,
      canUseSubscribeAndSave,
      description,
      reviews,
      mainImageUrl,
    },
    mainImageBase64,
  }
}

// ##################################
// End getProductDetails
// ##################################

// ##################################
// Start searchProducts
// ##################################

interface ProductSearchResult {
  asin: string
  title: string
  isSponsored: boolean
  brand?: string
  price?: string
  pricePerUnit?: string
  description?: {
    overview?: string
    features?: string
    facts?: string
    brandSnapshot?: string
  }
  reviews?: {
    averageRating?: string
    reviewCount?: string
  }
  imageUrl?: string
  isPrimeEligible: boolean
  deliveryInfo?: string
  productUrl?: string
}

export async function searchProducts(searchTerm: string): Promise<ProductSearchResult[]> {
  if (!searchTerm || searchTerm.trim().length === 0) {
    throw new Error('Search term is required and cannot be empty.')
  }

  let html: string
  if (USE_MOCKS) {
    console.error('[INFO][search-products] Fetching search results from mocks')
    const mockPath = `${__dirname}/../mocks/searchProducts.html`
    html = fs.readFileSync(mockPath, 'utf-8')
  } else {
    const url = `https://www.amazon.es/s?k=${encodeURIComponent(searchTerm)}`
    console.error(`[INFO][search-products] Searching for products with term "${searchTerm}" from ${url}`)

    const { browser, page } = await createBrowserAndPage()

    try {
      // Navigate to the search page
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 })

      // Handle login if needed
      await throwIfNotLoggedIn(page)

      // Wait for search results to load
      try {
        await page.waitForSelector('.s-search-results', { timeout: 10000 })
      } catch (e) {
        throw new Error(
          '[INFO][search-products] Could not find search results container. The search may have failed or returned no results.'
        )
      }

      if (EXPORT_LIVE_SCRAPING_FOR_MOCKS) {
        // Export the search results content to a mock file
        const timestamp = getTimestamp()
        const searchResultsHtml = await page.$eval('.s-search-results', el => el.outerHTML)
        const mockFileName = `searchProducts_${timestamp}.html`
        const mockPath = `${__dirname}/../mocks/${mockFileName}`
        fs.writeFileSync(mockPath, searchResultsHtml)
        console.error(`[INFO][search-products] Exported search results HTML to ${mockPath}`)
      }

      // Get the HTML content after JavaScript execution
      html = await page.content()
    } finally {
      await browser.close()
    }
  }

  const $ = cheerio.load(html)
  return extractSearchResultsPageData($, searchTerm)
}

function extractSearchResultsPageData($: cheerio.CheerioAPI, searchTerm: string): ProductSearchResult[] {
  const searchResults: ProductSearchResult[] = []

  // Find the search results using the actual Amazon structure
  const $productItems = $('[role="listitem"]')

  if ($productItems.length === 0) {
    console.error('[INFO][search-products] No search results found')
    return []
  }

  // Limit to first 20 items
  const limitedItems = $productItems.slice(0, 20)

  console.error(`[INFO][search-products] Found ${$productItems.length} products, processing first ${limitedItems.length}`)

  limitedItems.each((index, element) => {
    const $item = $(element)

    try {
      const productData = extractSearchResultSingleProductData($, $item)
      if (productData && productData.asin) {
        searchResults.push(productData)
        console.error(`[INFO][search-products] Extracted product ${index + 1}: ${productData.asin} - ${productData.title}`)
      }
    } catch (error) {
      console.error(`[INFO][search-products] Error extracting product ${index + 1}:`, error)
    }
  })

  console.error(`[INFO][search-products] Successfully extracted ${searchResults.length} products for search term "${searchTerm}"`)
  return searchResults
}

function extractSearchResultSingleProductData($: cheerio.CheerioAPI, $item: cheerio.Cheerio<any>): ProductSearchResult | null {
  // Extract ASIN
  const asin = $item.attr('data-asin')
  if (!asin) {
    return null
  }

  // Extract title and check if sponsored
  const titleElement = $item.find('h2[aria-label]')
  const fullTitle = titleElement.attr('aria-label') || ''
  const isSponsored = fullTitle.startsWith('Sponsored Ad – ')
  const title = isSponsored ? fullTitle.replace('Sponsored Ad – ', '') : fullTitle

  // Extract brand
  const brand = $item.find('h2.a-size-mini span.a-size-base-plus.a-color-base').text().trim() || undefined

  // Extract price information
  const price = $item.find('span.a-price[data-a-size="xl"] > span.a-offscreen').text().trim() || undefined

  // Extract price per unit (more complex selector)
  let pricePerUnit: string | undefined
  const pricePerUnitElement = $item.find('span.a-price[data-a-size="b"][data-a-color="secondary"] > span.a-offscreen')
  if (pricePerUnitElement.length > 0) {
    const parentText = pricePerUnitElement.parent().parent().text().trim()
    pricePerUnit = parentText || undefined
  }

  // Extract reviews
  const reviews: ProductSearchResult['reviews'] = {}

  const ratingElement = $item.find('i.a-icon-star-mini span.a-icon-alt')
  const ratingText = ratingElement.text().trim()
  if (ratingText) {
    reviews.averageRating = ratingText
  }

  const reviewCountElement = $item.find('a[aria-label*="ratings"] span.a-size-small')
  const reviewCount = reviewCountElement.text().trim()
  if (reviewCount) {
    reviews.reviewCount = reviewCount
  }

  // Extract image URL
  const imageUrl = $item.find('img.s-image').attr('src') || undefined

  // Check Prime eligibility
  const isPrimeEligible = $item.find('i.a-icon-prime').length > 0

  // Extract delivery information
  const deliveryInfo = $item.find('div.udm-primary-delivery-message').text().trim() || undefined

  // Extract product URL
  const productUrl = `https://www.amazon.es/-/en/gp/product/${asin}`

  return {
    asin,
    title,
    isSponsored,
    brand,
    price,
    pricePerUnit,
    reviews: Object.keys(reviews).length > 0 ? reviews : undefined,
    imageUrl,
    isPrimeEligible,
    deliveryInfo,
    productUrl,
  }
}

// ##################################
// End searchProducts
// ##################################
