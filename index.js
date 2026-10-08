#!/usr/bin/env node
"use strict";

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { x402Client, x402HTTPClient } = require("@x402/core/client");
const { ExactEvmScheme } = require("@x402/evm/exact/client");
const { toClientEvmSigner } = require("@x402/evm");
const { privateKeyToAccount } = require("viem/accounts");
const { createGuard } = require("./x402-guard");

const ALLOWED_API_ORIGIN = "https://kronos.forgemesh.io";
// Highest listed price is $0.15; the guard refuses to sign for any other payee, network, asset, or higher amount.
const guard = createGuard({
  baseUrl: ALLOWED_API_ORIGIN,
  payTo: ["0x1CcEf327b34853f6aC51464eA47fb3c291328D5E"],
  maxPriceUsd: 0.15,
  sessionBudgetUsd: 10,
});

const TOOLS = [
  {
    name: "get_kronos_signals",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Get current Kronos signal context and ranked symbols for BTC, ETH, SOL, XRP, and ADA. Costs $0.05 USDC.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "get_kronos_risk",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Get current Kronos market-risk state, signal streaks, and cooldown context. Costs $0.02 USDC.",
    inputSchema: { type: "object", additionalProperties: false, properties: {} },
  },
  {
    name: "get_kronos_history",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Get up to 168 hours of timestamped Kronos signal history for analysis and audit support. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { hours: { type: "integer", minimum: 1, maximum: 168, default: 24, description: "History window in hours." } },
    },
  },
  {
    name: "get_kronos_forecast",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Get a conformally calibrated 80% price range, current price, and upside probability for a supported symbol. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"], default: "BTC" } },
    },
  },
  {
    name: "check_kronos_preflight",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Check market state, cooldowns, freshness, and warnings before creating a Kronos decision journal. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"] } },
      required: ["symbol"],
    },
  },
  {
    name: "create_kronos_decision",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Create an auditable Kronos market-intelligence journal entry with directional bias, calibrated confidence, and decision_id. Costs $0.15 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"] } },
      required: ["symbol"],
    },
  },
  {
    name: "audit_kronos_decision",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Audit a prior Kronos decision_id against later prices and return its outcome verdict. Costs $0.07 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        decision_id: { type: "string", minLength: 1, maxLength: 128, pattern: "^[A-Za-z0-9._-]+$", description: "decision_id returned by create_kronos_decision." },
        window: { type: "string", enum: ["1h", "4h", "24h"], default: "4h" },
      },
      required: ["decision_id"],
    },
  },
  {
    name: "get_kronos_whale_flows",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Get whale, exchange, bridge, and stablecoin-flow context for Ethereum, Base, or Arbitrum. Costs $0.02 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        chain: { type: "string", enum: ["ethereum", "base", "arbitrum"], default: "base" },
        hours: { type: "integer", minimum: 1, maximum: 168, default: 4 },
      },
    },
  },
  {
    name: "get_kronos_futures_decision",
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Kronos Futures: perpetual-futures decision package for a symbol. Direction LONG / SHORT / FLAT from the Kronos signal, stop-loss and take-profit on the calibrated 80% range, leverage cap keeping liquidation outside 2x the stop, liquidation price, risk-based position size for your equity, and live perp funding cost. Market intelligence only; no exchange execution. Costs $0.15 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"] },
        equity: { type: "number", minimum: 0, description: "Account equity in USD for position sizing (optional)." },
        max_loss_pct: { type: "number", minimum: 0.0005, maximum: 0.2, default: 0.01, description: "Max loss per position as a fraction of equity." },
        max_leverage: { type: "number", minimum: 1, maximum: 5, default: 5, description: "Your own leverage ceiling." },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_kronos_perp_funding",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Kronos Futures: live perpetual funding rates (1h, 8h, annualized), mark and index price, open interest, and a LONG_CROWDED / SHORT_CROWDED / BALANCED crowding label for BTC, ETH, SOL, XRP, and ADA from Kraken Futures and Hyperliquid. Costs $0.02 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: { symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"], description: "Optional single symbol; omit for all five." } },
    },
  },
  {
    name: "check_kronos_futures_risk",
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    description: "Kronos Futures: will a leveraged perp position survive the calibrated range? Returns liquidation price and distance, the adverse range bound, a SURVIVES_RANGE / THIN_BUFFER / LIQUIDATION_INSIDE_RANGE verdict, the max leverage that still survives, P&L at both range bounds, and funding cost. Costs $0.05 USDC.",
    inputSchema: {
      type: "object", additionalProperties: false,
      properties: {
        symbol: { type: "string", enum: ["BTC", "ETH", "SOL", "XRP", "ADA"], default: "BTC" },
        side: { type: "string", enum: ["LONG", "SHORT"] },
        leverage: { type: "number", minimum: 1, maximum: 125 },
        entry: { type: "number", minimum: 0, description: "Entry price; defaults to current perp mark." },
        notional: { type: "number", minimum: 0, description: "Position notional in USD for funding cost (optional)." },
        horizon_hours: { type: "integer", minimum: 1, maximum: 168, description: "Hours held for funding cost; defaults to the forecast horizon." },
      },
      required: ["side", "leverage"],
    },
  },
];

function futuresQuery(args, keys) {
  const parts = [];
  for (const key of keys) {
    if (args[key] === undefined || args[key] === null || args[key] === "") continue;
    parts.push(`${key}=${encodeURIComponent(String(args[key]))}`);
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

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
    case "get_kronos_futures_decision": return `/api/kronos/futures/decision${futuresQuery(args, ["symbol", "equity", "max_loss_pct", "max_leverage"])}`;
    case "get_kronos_perp_funding": return `/api/kronos/futures/funding${futuresQuery(args, ["symbol"])}`;
    case "check_kronos_futures_risk": return `/api/kronos/futures/risk${futuresQuery(args, ["symbol", "side", "leverage", "entry", "notional", "horizon_hours"])}`;
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

function buildPaymentClient() {
  const key = process.env.WALLET_PRIVATE_KEY;
  if (!key) throw new Error("WALLET_PRIVATE_KEY is required; use a dedicated low-balance Base wallet funded with USDC");
  if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key)) throw new Error("WALLET_PRIVATE_KEY must be a 32-byte hexadecimal private key");
  const account = privateKeyToAccount(key.startsWith("0x") ? key : `0x${key}`);
  const client = new x402Client().register("eip155:*", new ExactEvmScheme(toClientEvmSigner(account))).registerPolicy(guard.policy);
  return new x402HTTPClient(client);
}

// Validate arguments against the tool's own inputSchema before any network call or payment.
function validateArgs(name, args) {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) throw new Error(`Unknown tool: ${name}`);
  if (args === null || typeof args !== "object" || Array.isArray(args)) throw new Error("arguments must be an object");
  const props = tool.inputSchema.properties || {};
  for (const key of Object.keys(args)) if (!props[key]) throw new Error(`Unexpected argument: ${key}`);
  for (const key of tool.inputSchema.required || []) if (args[key] === undefined) throw new Error(`Missing required argument: ${key}`);
  for (const [key, spec] of Object.entries(props)) {
    const v = args[key];
    if (v === undefined) continue;
    if (spec.type === "string") {
      if (typeof v !== "string" || v.length < (spec.minLength || 0) || v.length > (spec.maxLength || 2000)) throw new Error(`Invalid ${key}: expected string of valid length`);
      if (spec.enum && !spec.enum.includes(v)) throw new Error(`Invalid ${key}: must be one of ${spec.enum.join(", ")}`);
      if (spec.pattern && !new RegExp(spec.pattern).test(v)) throw new Error(`Invalid ${key}: unexpected characters`);
    } else if (spec.type === "integer" || spec.type === "number") {
      if (typeof v !== "number" || !Number.isFinite(v) || (spec.type === "integer" && !Number.isInteger(v))) throw new Error(`Invalid ${key}: expected ${spec.type}`);
      if (spec.minimum !== undefined && v < spec.minimum) throw new Error(`Invalid ${key}: minimum is ${spec.minimum}`);
      if (spec.maximum !== undefined && v > spec.maximum) throw new Error(`Invalid ${key}: maximum is ${spec.maximum}`);
    }
  }
}

async function main() {
  let paymentClient;
  const getPaymentClient = () => paymentClient || (paymentClient = buildPaymentClient());
  const server = new Server({ name: "kronos-forgemesh-mcp", version: require("./package.json").version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const args = request.params.arguments || {};
      validateArgs(request.params.name, args);
      const data = await guard.callPaid(getPaymentClient(), buildToolPath(request.params.name, args));
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

module.exports = { TOOLS, buildToolPath, validateArgs };
