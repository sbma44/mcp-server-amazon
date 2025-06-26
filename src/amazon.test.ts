import { getProductDetails, searchProducts } from './amazon.js'

async function testGetProductDetails_regular() {
  console.log('\n\n--------------------------------------')
  console.log('Run testGetProductDetails_regular...')
  try {
    const testAsin = 'B0F2255HFW'
    console.log(`Testing getProductDetails with ASIN: ${testAsin}`)

    const result = await getProductDetails(testAsin)
    console.log('Result data:')
    console.log(result.data)

    // Basic validation
    if (result.data.asin === testAsin && result.data.title && result.data.price) {
      console.log('✅ Test passed: Product details successfully retrieved')
    } else {
      console.log('❌ Test failed: Missing required product data')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

async function testGetProductDetails_subscribeAndSave() {
  console.log('\n\n--------------------------------------')
  console.log('Run testGetProductDetails_subscribeAndSave...')
  try {
    const testAsin = 'B0B15FKR8T'
    console.log(`Testing getProductDetails with ASIN: ${testAsin}`)

    const result = await getProductDetails(testAsin)
    console.log('Result data:')
    console.log(result.data)

    // Basic validation
    if (result.data.asin === testAsin && result.data.title && result.data.price) {
      console.log('✅ Test passed: Product details successfully retrieved')
    } else {
      console.log('❌ Test failed: Missing required product data')
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

async function testInvalidAsin() {
  console.log('\n\n--------------------------------------')
  console.log('Run testInvalidAsin...')
  try {
    console.log('\nTesting getProductDetails with invalid ASIN...')
    await getProductDetails('INVALID')
    console.log('❌ Test failed: Should have thrown an error for invalid ASIN')
  } catch (error: any) {
    console.log('✅ Test passed: Correctly rejected invalid ASIN')
    console.log(`   Error: ${error.message}`)
  }
}

async function testSearchProducts() {
  console.log('🧪 Testing Amazon Search Products functionality...')
  console.log('='.repeat(50))

  // Test 1: Basic search functionality
  console.log('\n📦 Test 1: Basic search for "collagen"')
  console.log('-'.repeat(30))
  try {
    const results = await searchProducts('collagen')
    console.log(`✅ Found ${results.length} products`)

    if (results.length > 0) {
      const firstProduct = results[0]
      console.log(`📍 First product:`)
      console.log(`   ASIN: ${firstProduct.asin}`)
      console.log(`   Title: ${firstProduct.title}`)
      console.log(`   Price: ${firstProduct.price || 'N/A'}`)
      console.log(`   Brand: ${firstProduct.brand || 'N/A'}`)
      console.log(`   Sponsored: ${firstProduct.isSponsored}`)
      console.log(`   Prime: ${firstProduct.isPrimeEligible}`)
      console.log(`   Reviews: ${firstProduct.reviews?.averageRating || 'N/A'} (${firstProduct.reviews?.reviewCount || 'N/A'} reviews)`)
      console.log(`   Delivery: ${firstProduct.deliveryInfo || 'N/A'}`)

      console.log()
      console.log()
      console.log()
      console.log('Logging first 5 products:')
      console.log(results.slice(0, 5))
    }
  } catch (error) {
    console.log(`❌ Error: ${error}`)
  }
}

async function main() {
  console.log('Running getProductDetails tests...\n')
  await testGetProductDetails_regular()
  await testGetProductDetails_subscribeAndSave()
  await testInvalidAsin()
  console.log('\nRunning searchProducts tests...\n')
  await testSearchProducts()
  console.log('\nAll tests completed.')
}

main().catch(console.error)