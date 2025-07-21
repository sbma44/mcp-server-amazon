import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getProductDetails, searchProducts } from './amazon.js'

// Create server instance
const server = new McpServer({
  name: 'amazon',
  version: '1.0.0',
})

// Add search products tool
server.tool(
  'search-products',
  'Search for products on Amazon and return a list of results',
  {
    searchTerm: z
      .string()
      .min(1, { message: 'Search term cannot be empty.' })
      .describe('The search term to use for finding products on Amazon'),
  },
  async ({ searchTerm }) => {
    try {
      const results = await searchProducts(searchTerm)
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(results, null, 2),
          },
        ],
      }
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while searching for products. Error: ${error.message}`,
          },
        ],
      }
    }
  }
)

// Add get product details tool
server.tool(
  'get-product-details',
  'Get detailed information about a product using its ASIN',
  {
    asin: z
      .string()
      .length(10, { message: 'ASIN must be a 10-character string.' })
      .describe('The ASIN (Amazon Standard Identification Number) of the product to get details for. Must be a 10-character string.'),
  },
  async ({ asin }) => {
    let result: Awaited<ReturnType<typeof getProductDetails>>
    try {
      result = await getProductDetails(asin)
    } catch (error: any) {
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while retrieving product details. Error: ${error.message}`,
          },
        ],
      }
    }

    const content: any[] = []

    // Add product image if available
    if (result.mainImageBase64) {
      content.push({
        type: 'image',
        data: result.mainImageBase64,
        mimeType: 'image/jpeg'
      })
    }

    // Add formatted product details
    const productInfo = `# ${result.data.title}

**ASIN:** ${result.data.asin}
**Price:** ${result.data.price}
**Subscribe & Save Available:** ${result.data.canUseSubscribeAndSave ? 'Yes' : 'No'}

## Reviews
${result.data.reviews.averageRating ? `⭐ **Rating:** ${result.data.reviews.averageRating}` : ''}
${result.data.reviews.reviewsCount ? `📝 **Reviews:** ${result.data.reviews.reviewsCount}` : ''}

## Description
${result.data.description.overview ? `**Overview:**\n${result.data.description.overview}\n\n` : ''}
${result.data.description.features ? `**Features:**\n${result.data.description.features}\n\n` : ''}
${result.data.description.facts ? `**Product Facts:**\n${result.data.description.facts}\n\n` : ''}
${result.data.description.brandSnapshot ? `**Brand Info:**\n${result.data.description.brandSnapshot}\n\n` : ''}

---
*Product URL: https://www.amazon.com/dp/${result.data.asin}*`

    content.push({
      type: 'text',
      text: productInfo
    })

    return { content }
  }
)

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  process.exit(1)
})


