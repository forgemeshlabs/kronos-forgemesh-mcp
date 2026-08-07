#!/usr/bin/env node
"use strict";

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { x402Client, x402HTTPClient } = require("@x402/core/client");
const { ExactEvmScheme } = require("@x402/evm/exact/client");
const { toClientEvmSigner } = require("@x402/evm");
const { privateKeyToAccount } = require("viem/accounts");
const { createPublicClient, http } = require("viem");
const { base } = require("viem/chains");

const API_URL = String(process.env.KRONOS_API_URL || "https://kronos.forgemesh.io").replace(/\/$/, "");
const BASE_RPC_URL = process.env.BASE_RPC_URL || "https://mainnet.base.org";
const ALLOWED_API_ORIGIN = "https://kronos.forgemesh.io";

const TOOLS = [
  {
    name: "get_kronos_signals",
    description: "Get current Kronos signal context and ranked symbols for BTC, ETH, SOL, XRP, and ADA. Costs $0.05 USDC.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "get_kronos_risk",
    description: "Get current Kronos market-risk state, signal streaks, and cooldown context. Costs $0.02 USDC.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "get_kronos_history",
    description: "Get up to 168 hours of timestamped Kronos signal history for analysis and audit support. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { hours: { type: "integer", minimum: 1, maximum: 168, default: 24, description: "History window in hours." } },
    },
  },
  {
    name: "get_kronos_forecast",
    description: "Get a conformally calibrated 80% price range, current price, and upside probability for a supported symbol. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"], default: "BTC" } },
    },
  },
  {
    name: "check_kronos_preflight",
    description: "Check market state, cooldowns, freshness, and warnings before creating a Kronos decision journal. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"] } },
      required: ["symbol"],
    },
  },
  {
    name: "create_kronos_decision",
    description: "Create an auditable Kronos market-intelligence journal entry with directional bias, calibrated confidence, and decision_id. Costs $0.15 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"] } },
      required: ["symbol"],
    },
  },
  {
    name: "audit_kronos_decision",
    description: "Audit a prior Kronos decision_id against later prices and return its outcome verdict. Costs $0.07 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        decision_id: { type: "string", minLength: 1, description: "decision_id returned by create_kronos_decision." },
        window: { type: "string", enum: ["1h", "4h", "24h"], default: "4h" },
      },
      required: ["decision_id"],
    },
  },
  {
    name: "get_kronos_whale_flows",
    description: "Get whale, exchange, bridge, and stablecoin-flow context for Ethereum, Base, or Arbitrum. Costs $0.02 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        chain: { type: "string", enum: ["ethereum", "base", "arbitrum"], default: "base" },
        hours: { type: "integer", minimum: 1, maximum: 168, default: 4 },
      },
    },
  },
];

function buildToolPath(name, args = {}) {
  switch (name) {
    case "get_kronos_signals": return "/api/signals";
    case "get_kronos_risk": return "/api/kronos/risk";
    case "get_kronos_history": return `/api/kronos/history?hours=${Number(args.hours || 24)}`;
    case "get_kronos_forecast": return `/api/kronos/forecast?symbol=${encodeURIComponent(args.symbol || "BTC")}`;
    case "check_kronos_preflight": return `/api/kronos/preflight?symbol=${encodeURIComponent(args.symbol)}`;
    case "create_kronos_decision": return `/api/kronos/decision?symbol=${encodeURIComponent(args.symbol)}`;
    case "audit_kronos_decision": return `/api/kronos/audit?decision_id=${encodeURIComponent(args.decision_id)}&window=${encodeURIComponent(args.window || "4h")}`;
    case "get_kronos_whale_flows": return `/api/whale?chain=${encodeURIComponent(args.chain || "base")}&hours=${Number(args.hours || 4)}`;
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function validateApiUrl(url) {
  const parsed = new URL(url);
  if (parsed.origin !== ALLOWED_API_ORIGIN) throw new Error(`KRONOS_API_URL must use ${ALLOWED_API_ORIGIN}`);
  return parsed.origin;
}

function buildPaymentClient() {
  const key = process.env.WALLET_PRIVATE_KEY;
  if (!key) throw new Error("WALLET_PRIVATE_KEY is required; use a dedicated low-balance Base wallet funded with USDC");
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key)) throw new Error("WALLET_PRIVATE_KEY must be a 32-byte hexadecimal private key");
  const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
  const client = new x402Client().register("eip155:*", new ExactEvmScheme(toClientEvmSigner(account)));
  return new x402HTTPClient(client);
}

async function createChainTimedPayload(httpClient, paymentRequired) {
  try {
    const publicClient = createPublicClient({ chain: base, transport: http(BASE_RPC_URL) });
    const chainNow = Number((await publicClient.getBlock()).timestamp);
    const originalNow = Date.now;
    const localNow = Math.floor(originalNow() / 1000);
    const timeout = Number(paymentRequired.accepts?.[0]?.maxTimeoutSeconds || 300);
    const signingNow = Math.min(Math.max(chainNow, localNow + 30 - timeout), chainNow + 600);
    Date.now = () => signingNow * 1000;
    try { return await httpClient.createPaymentPayload(paymentRequired); }
    finally { Date.now = originalNow; }
  } catch (_) {
    return httpClient.createPaymentPayload(paymentRequired);
  }
}

async function callPaid(httpClient, path) {
  const origin = validateApiUrl(API_URL);
  const url = `${origin}${path}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (response.status !== 402) {
    if (!response.ok) throw new Error(`Kronos API returned HTTP ${response.status}`);
    return response.json();
  }

  let responseBody;
  try { responseBody = await response.clone().json(); } catch (_) {}
  const required = httpClient.getPaymentRequiredResponse((header) => response.headers.get(header), responseBody);
  const payload = await createChainTimedPayload(httpClient, required);
  const paid = await fetch(url, {
    headers: httpClient.encodePaymentSignatureHeader(payload),
    signal: AbortSignal.timeout(60_000),
  });
  if (!paid.ok) {
    const body = await paid.text().catch(() => "");
    throw new Error(`Paid Kronos request returned HTTP ${paid.status}: ${body.slice(0, 240)}`);
  }
  const data = await paid.json();
  try {
    const settlement = httpClient.getPaymentSettleResponse((header) => paid.headers.get(header));
    if (settlement && data && typeof data === "object" && !Array.isArray(data)) return { ...data, _payment: settlement };
  } catch (_) {}
  return data;
}

async function main() {
  let paymentClient;
  const getPaymentClient = () => paymentClient || (paymentClient = buildPaymentClient());
  const server = new Server({ name: "kronos-forgemesh-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const args = request.params.arguments || {};
      const data = await callPaid(getPaymentClient(), buildToolPath(request.params.name, args));
      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    } catch (error) {
      return {
        isError: true,
        content: [{ type: "text", text: JSON.stringify({ code: "KRONOS_TOOL_ERROR", message: error.message }) }],
      };
    }
  });

  await server.connect(new StdioServerTransport());
  process.stdin.resume();
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`kronos-forgemesh-mcp failed: ${error.message}\n`);
  process.exit(1);
});

module.exports = { TOOLS, buildToolPath, validateApiUrl };
