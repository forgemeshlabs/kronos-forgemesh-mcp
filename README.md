# Kronos by ForgeMesh MCP

[![M8ven Verified](https://m8ven.ai/badge/mcp/forgemeshlabs-kronos-forgemesh-mcp-1dod5h?variant=verified)](https://m8ven.ai/mcp/forgemeshlabs-kronos-forgemesh-mcp-1dod5h)
[![mcpservers.org](https://mcpservers.org/badge.svg)](https://mcpservers.org/servers/forgemeshlabs/kronos-forgemesh-mcp)

An MCP stdio server that lets agents purchase structured Kronos market
intelligence from `https://kronos.forgemesh.io` using x402 USDC payments on
Base. This is the agent client layer for the third Kronos product origin.

## Build your own Kronos

Want to build your own Kronos market-intelligence and paper-trading system
instead of calling this one? The **Kronos Field Guide** is the ebook + coding-agent
build package we kept being asked for: two learning paths, 81 explained
configuration fields, the documented failures of our own paper setup, and two
self-contained briefs you hand to Claude Code, Codex or Cursor.
https://forgemesh.io/kronos/field-guide — educational only, not financial
advice, no support of any kind.

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
| `get_kronos_perp_funding` | **Futures.** Live perp funding, mark/index, open interest, crowding (Kraken Futures + Hyperliquid) | $0.02 |
| `check_kronos_futures_risk` | **Futures.** Will this side / leverage / entry survive the calibrated range? Liquidation distance + verdict | $0.05 |
| `get_kronos_futures_decision` | **Futures.** LONG / SHORT / FLAT with stop and target on the calibrated range, leverage cap, liquidation price, sizing, funding cost | $0.15 |

### Kronos Futures (new in 0.2.0)

The three futures tools turn a bearish Kronos signal into a sized short instead
of "stay out". Direction comes from the same spot signal; stop and target sit on
the conformally calibrated 80% range; leverage is capped so liquidation stays
outside twice the stop distance and never exceeds the Kronos risk state
(NORMAL 3x, ELEVATED 2x, HIGH 1x, absolute 5x). Funding is read live from
Kraken Futures and Hyperliquid. No exchange execution ever happens; the output
is market intelligence, not a trade instruction. Leverage multiplies losses and
adds liquidation risk.

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
only when an agent invokes one of the eleven tools.

Unpaid challenge requests time out after 30 seconds; paid retries time out
after 60 seconds. Errors are returned as structured `KRONOS_TOOL_ERROR`
payloads so the calling agent can recover without reading server logs.

Market intelligence only. Outputs are not instructions to transact.

Source: https://github.com/forgemeshlabs/kronos-forgemesh-mcp
