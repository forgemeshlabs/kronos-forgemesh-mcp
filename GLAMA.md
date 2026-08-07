# Glama Build Instructions

Dockerfile URL:

`https://github.com/forgemeshlabs/kronos-forgemesh-mcp/blob/main/Dockerfile`

Build steps:

```json
["npm ci --omit=dev"]
```

Command arguments:

```json
["node", "index.js"]
```

Required environment variables:

- `WALLET_PRIVATE_KEY` — secret; dedicated low-balance Base wallet funded with USDC for x402 calls.

Optional environment variables:

- `BASE_RPC_URL` — Base mainnet RPC override. Defaults to `https://mainnet.base.org`.
- `KRONOS_API_URL` — production API origin. The runtime restricts this to `https://kronos.forgemesh.io`.

Runtime: Node.js 20 or newer, stdio transport. Tool listing does not spend USDC or require the wallet to be initialized. The wallet is loaded only when a paid tool is invoked.

