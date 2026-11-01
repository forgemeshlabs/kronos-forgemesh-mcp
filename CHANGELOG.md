# Changelog

## 0.2.3

- Dependencies: @x402/core + @x402/evm 2.11.0 → 2.29.0 (drops the transitive vulnerable zod); lockfile refresh resolving the open npm advisories (zod via @x402/core, body-parser, fast-uri, qs, ip-address, @hono/node-server as applicable). No behavior change.

## 0.2.0 — 2026-09-25

- Added the Kronos Futures tools: `get_kronos_futures_decision` ($0.15), `get_kronos_perp_funding` ($0.02), `check_kronos_futures_risk` ($0.05) over the new `/api/kronos/futures/*` routes.
- Eleven tools total. No change to payment handling or the allowlisted origin.

## 0.1.0 — 2026-08-07

- Added eight Kronos market-intelligence tools over MCP stdio.
- Added automatic x402 USDC payment handling on Base mainnet.
- Restricted production requests to `https://kronos.forgemesh.io`.
- Added structured errors, request timeouts, contract tests, and MCP manifest metadata.
- Added Glama registry metadata and reproducible container build instructions.
