# Kronos by ForgeMesh MCP

An MCP stdio server that lets agents purchase structured Kronos market
intelligence from `https://kronos.forgemesh.io` using x402 USDC payments on
Base. This is the agent client layer for the third Kronos product origin.

## Tools

| Tool | Purpose | Price |
| --- | --- | ---: |
| `get_kronos_risk` | Risk state, streaks, and cooldown context | $0.02 |
| `get_kronos_whale_flows` | Whale, exchange, bridge, and stablecoin flows | $0.02 |
| `get_kronos_signals` | Current multi-symbol signal context | $0.05 |
| `get_kronos_history` | Up to 168 hours of signal history | $0.05 |
| `get_kronos_forecast` | Calibrated 80% range and upside probability | $0.05 |
| `check_kronos_preflight` | Conditions check before journaling | $0.05 |
| `audit_kronos_decision` | Outcome audit for a prior `decision_id` | $0.07 |
| `create_kronos_decision` | Auditable market-intelligence journal | $0.15 |

## Install

```bash
npx -y @forgemeshlabs/kronos-forgemesh-mcp
```

The private key stays local and is used only to sign x402 payment
authorizations. Use a dedicated low-balance Base wallet; never use a primary
wallet. The server allowlists `https://kronos.forgemesh.io` as its only
production API origin.

## Claude Code / Desktop

```json
{
  "mcpServers": {
    "kronos": {
      "command": "npx",
      "args": ["-y", "@forgemeshlabs/kronos-forgemesh-mcp"],
      "env": {
        "WALLET_PRIVATE_KEY": "0x<dedicated-low-balance-wallet-key>"
      }
    }
  }
}
```

No payment occurs when the server starts or lists its tools. Payment happens
only when an agent invokes one of the eight tools.

Unpaid challenge requests time out after 30 seconds; paid retries time out
after 60 seconds. Errors are returned as structured `KRONOS_TOOL_ERROR`
payloads so the calling agent can recover without reading server logs.

Market intelligence only. Outputs are not instructions to transact.

Source: https://github.com/forgemeshlabs/kronos-forgemesh-mcp
