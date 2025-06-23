import { getProductDetails } from './amazon.js'

async function testGetProductDetails_regular() {
  console.log('\n\n--------------------------------------')
  console.log('Run testGetProductDetails_regular...')
  try {
    const testAsin = 'B0F2255HFW'
    console.log(`Testing getProductDetails with ASIN: ${testAsin}`)

    const result = await getProductDetails(testAsin)
    console.log('Result:')
    console.log(result)

    // Basic validation
    if (result.asin === testAsin && result.title && result.price) {
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
    console.log('Result:')
    console.log(result)

    // Basic validation
    if (result.asin === testAsin && result.title && result.price) {
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

async function main() {
  console.log('Running getProductDetails tests...\n')
  await testGetProductDetails_regular()
  await testGetProductDetails_subscribeAndSave()
  await testInvalidAsin()
  console.log('\nTests completed.')
}

main().catch(console.error)
