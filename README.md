# Amazon MCP Server

This server allows you to interact with Amazon's services (specifically amazon.com for the US market and English language) using the MCP (Model Context Protocol) framework. This lets you use Amazon through AI interfaces.

## Features

- **Product search**: Search for products on Amazon.com
- **Product details**: Retrieve detailed information about a specific product on Amazon.com

## Install

Install dependencies

```sh
npm install -D
```

Build the project

```sh
npm run build
```

## Claude Desktop Integration

Create or update `~/Library/Application Support/Claude/claude_desktop_config.json` with the path to the MCP server.

```json
{
  "mcpServers": {
    "amazon": {
      "command": "node",
      "args": ["/Users/admin/dev/mcp-server-amazon/build/index.js"]
    }
  }
}
```

Restart the Claude Desktop app to apply the changes. You should now see the Amazon MCP server listed in the Claude Desktop app.

## Troubleshooting

The MCP server logs its output to a file. If you encounter any issues, you can check the log file for more information.

See `~/Library/Logs/Claude/mcp-server-amazon.log`

## License

[The MIT license](./LICENSE)
