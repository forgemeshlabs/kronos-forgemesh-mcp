"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { TOOLS, buildToolPath, validateApiUrl } = require("../index");

test("tool contracts have unique verb-first names and object schemas", () => {
  assert.equal(TOOLS.length, 11);
  assert.equal(new Set(TOOLS.map((tool) => tool.name)).size, TOOLS.length);
  for (const tool of TOOLS) {
    assert.match(tool.name, /^(get|check|create|audit)_/);
    assert.ok(tool.description.length >= 40);
    assert.equal(tool.inputSchema.type, "object");
    assert.equal(tool.inputSchema.additionalProperties, false);
  }
});

test("tool arguments map to canonical Kronos routes", () => {
  assert.equal(buildToolPath("get_kronos_signals"), "/api/signals");
  assert.equal(buildToolPath("get_kronos_forecast", { symbol: "ETH" }), "/api/kronos/forecast?symbol=ETH");
  assert.equal(buildToolPath("audit_kronos_decision", { decision_id: "a/b", window: "1h" }), "/api/kronos/audit?decision_id=a%2Fb&window=1h");
  assert.equal(buildToolPath("get_kronos_whale_flows", { chain: "base", hours: 8 }), "/api/whale?chain=base&hours=8");
  assert.equal(buildToolPath("get_kronos_futures_decision", { symbol: "SOL", equity: 5000, max_loss_pct: 0.01, max_leverage: 3 }), "/api/kronos/futures/decision?symbol=SOL&equity=5000&max_loss_pct=0.01&max_leverage=3");
  assert.equal(buildToolPath("get_kronos_perp_funding", {}), "/api/kronos/futures/funding");
  assert.equal(buildToolPath("get_kronos_perp_funding", { symbol: "ETH" }), "/api/kronos/futures/funding?symbol=ETH");
  assert.equal(buildToolPath("check_kronos_futures_risk", { side: "LONG", leverage: 10, notional: 2000 }), "/api/kronos/futures/risk?side=LONG&leverage=10&notional=2000");
});

test("outbound origin is allowlisted", () => {
  assert.equal(validateApiUrl("https://kronos.forgemesh.io"), "https://kronos.forgemesh.io");
  assert.throws(() => validateApiUrl("https://example.com"), /must use/);
});

