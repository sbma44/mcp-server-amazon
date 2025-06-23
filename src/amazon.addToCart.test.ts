import { addToCart } from './amazon.js'
import { USE_MOCKS } from './config.js'

async function testAddToCart() {
  if (USE_MOCKS) {
    console.log('Skipping addToCart test because USE_MOCKS is enabled')
    return
  }

  try {
    // Test with a valid ASIN (example product)
    const testAsin = 'B0CM8P9PV9' // ASIN with insurance option
    // const testAsin = 'B0B15FKR8T' // ASIN with subscription option

    console.log(`Testing addToCart with ASIN: ${testAsin}`)

    const result = await addToCart(testAsin)
    console.log('Result:', result)

    if (result.success) {
      console.log('✅ Test passed: Product successfully added to cart')
    } else {
      console.log('❌ Test failed: Product was not added to cart')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

// Run test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAddToCart()
}
