import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { getOrdersHistory, getCartContent, addToCart } from './amazon.js'

// Create server instance
const server = new McpServer({
  name: 'amazon',
  version: '1.0.0',
})

server.tool('get-orders-history', 'Get orders history for a user', {}, async ({}) => {
  let ordersHistory: Awaited<ReturnType<typeof getOrdersHistory>>
  try {
    ordersHistory = await getOrdersHistory()
  } catch (error: any) {
    console.error('[ERROR][get-orders-history] Error in get-orders-history tool:', error)
    return {
      content: [
        {
          type: 'text',
          text: `An error occurred while retrieving orders history. Error: ${error.message}`,
        },
      ],
    }
  }

  if (!ordersHistory || ordersHistory.length === 0) {
    return {
      content: [
        {
          type: 'text',
          text: 'No orders found.',
        },
      ],
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(ordersHistory, null, 2),
      },
    ],
  }
})

server.tool('get-cart-content', 'Get the current cart content for a user', {}, async ({}) => {
  let cartContent: Awaited<ReturnType<typeof getCartContent>>
  try {
    cartContent = await getCartContent()
  } catch (error: any) {
    console.error('[ERROR][get-cart-content] Error in get-cart-content tool:', error)
    return {
      content: [
        {
          type: 'text',
          text: `An error occurred while retrieving cart content. Error: ${error.message}`,
        },
      ],
    }
  }

  if (cartContent.isEmpty) {
    return {
      content: [
        {
          type: 'text',
          text: 'Your Amazon cart is empty.',
        },
      ],
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(cartContent, null, 2),
      },
    ],
  }
})

server.tool(
  'add-to-cart',
  'Add a product to the Amazon cart using ASIN',
  {
    asin: z
      .string()
      .length(10, { message: 'ASIN must be a 10-character string.' })
      .describe('The ASIN (Amazon Standard Identification Number) of the product to add to cart. Must be a 10-character string.'),
  },
  async ({ asin }) => {
    let result: Awaited<ReturnType<typeof addToCart>>
    try {
      result = await addToCart(asin)
    } catch (error: any) {
      console.error('[ERROR][add-to-cart] Error in add-to-cart tool:', error)
      return {
        content: [
          {
            type: 'text',
            text: `An error occurred while adding product to cart. Error: ${error.message}`,
          },
        ],
      }
    }

    return {
      content: [
        {
          type: 'text',
          text: result.success ? `✅ ${result.message}` : `❌ Failed to add product to cart: ${result.message}`,
        },
      ],
    }
  }
)

// Start the server
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('[INFO] Amazon MCP Server running on stdio')
}

main().catch(error => {
  console.error('[ERROR] Fatal error in main():', error)
  process.exit(1)
})
