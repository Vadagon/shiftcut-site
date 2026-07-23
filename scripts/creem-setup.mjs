#!/usr/bin/env node
// One-shot Creem setup: creates the two AI Copilot products and writes their
// IDs back into .env.local. Run once, after CREEM_API_KEY is set.
//
//   node scripts/creem-setup.mjs
//
// Idempotent-ish: if products with the same names already exist, it reuses them
// instead of creating duplicates.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env.local");

// ── read .env.local ──────────────────────────────────────────
function readEnv() {
  const map = {};
  if (!existsSync(envPath)) return map;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) map[m[1]] = m[2];
  }
  return map;
}

function writeEnvVar(name, value) {
  let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const re = new RegExp(`^${name}=.*$`, "m");
  if (re.test(text)) text = text.replace(re, `${name}=${value}`);
  else text += `${text.endsWith("\n") ? "" : "\n"}${name}=${value}\n`;
  writeFileSync(envPath, text);
}

const env = readEnv();
const API_KEY = process.env.CREEM_API_KEY || env.CREEM_API_KEY;
const MODE = process.env.CREEM_MODE || env.CREEM_MODE || "live";
const BASE = MODE === "live" ? "https://api.creem.io/v1" : "https://test-api.creem.io/v1";

if (!API_KEY) {
  console.error("✖ CREEM_API_KEY not found in environment or .env.local");
  process.exit(1);
}

const headers = { "x-api-key": API_KEY, "Content-Type": "application/json" };

const PRODUCTS = [
  {
    envVar: "CREEM_PRODUCT_ID_MONTHLY",
    body: {
      name: "ShiftCut AI Copilot — Monthly",
      description:
        "In-editor natural-language video editing (AI Copilot). Includes a 3-day free trial, then $10/month. Cancel anytime.",
      price: 1000,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "every-month",
      trial_period_days: 3,
      tax_mode: "inclusive",
      tax_category: "saas",
    },
  },
  {
    envVar: "CREEM_PRODUCT_ID_YEARLY",
    body: {
      name: "ShiftCut AI Copilot — Yearly",
      description: "In-editor natural-language video editing (AI Copilot). $60/year. Cancel anytime.",
      price: 6000,
      currency: "USD",
      billing_type: "recurring",
      billing_period: "every-year",
      tax_mode: "inclusive",
      tax_category: "saas",
    },
  },
];

async function findExisting(name) {
  const res = await fetch(`${BASE}/products/search?page_number=1&page_size=100`, { headers });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  const items = Array.isArray(data) ? data : data?.items ?? [];
  return items.find((p) => p?.name === name) ?? null;
}

async function createProduct(body) {
  // Try with trial first; if the API rejects the trial field, retry without it.
  let res = await fetch(`${BASE}/products`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok && "trial_period_days" in body) {
    const { trial_period_days, ...rest } = body;
    void trial_period_days;
    res = await fetch(`${BASE}/products`, { method: "POST", headers, body: JSON.stringify(rest) });
    if (res.ok) console.warn(`  ⚠ trial field not accepted — created without trial. Set the 3-day trial in the Creem dashboard.`);
  }
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`create failed (${res.status}): ${err}`);
  }
  return res.json();
}

console.log(`Creem setup — mode: ${MODE}\n`);
for (const { envVar, body } of PRODUCTS) {
  process.stdout.write(`• ${body.name} … `);
  let product = await findExisting(body.name);
  if (product) {
    console.log(`already exists (${product.id})`);
  } else {
    product = await createProduct(body);
    console.log(`created (${product.id})`);
  }
  writeEnvVar(envVar, product.id);
  console.log(`  → ${envVar}=${product.id}`);
}

console.log("\n✔ Product IDs written to .env.local.");
console.log("Next: add CREEM_WEBHOOK_SECRET (Creem → Developers → Webhooks), then restart the dev server.");
