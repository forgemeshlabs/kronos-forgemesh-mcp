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

Optional environment variables (can only lower the built-in caps):

- `X402_MAX_PRICE_USD` — per-call price ceiling (built-in cap $0.15).
- `X402_SESSION_BUDGET_USD` — cumulative ceiling per process (built-in cap $10).

Runtime: Node.js 20 or newer, stdio transport. Tool listing does not spend USDC or require the wallet to be initialized. The wallet is loaded only when a paid tool is invoked.

