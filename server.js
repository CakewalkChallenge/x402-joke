import { readFileSync } from "node:fs";
import "dotenv/config";
import express from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactStellarScheme } from "@x402/stellar/exact/server";
import { HTTPFacilitatorClient } from "@x402/core/server";

// --- config ---------------------------------------------------------------
const PORT = process.env.PORT || 4022;
const PAY_TO = process.env.ADDRESS;                       // your receiving Stellar account (G...)
const NETWORK = process.env.NETWORK || "stellar:testnet"; // Stellar testnet
const FACILITATOR_URL = process.env.FACILITATOR_URL || "https://x402.org/facilitator";
const PRICE = process.env.PRICE || "$0.001";

if (!PAY_TO) {
  console.error("Set ADDRESS in .env to the Stellar account (G...) that should receive payments.");
  process.exit(1);
}

// jokes stored on the server as a JSON file
const jokes = JSON.parse(readFileSync(new URL("./jokes.json", import.meta.url)));

// --- x402 wiring --------------------------------------------------------------
// The facilitator verifies + settles payments (Circle USDC on Stellar via a
// Soroban token transfer) so this server never touches the network itself.
const facilitator = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitator).register(
  "stellar:*",
  new ExactStellarScheme(),
);

const app = express();

// Gate GET /joke behind a payment. Unpaid requests get HTTP 402 + payment
// instructions; the middleware verifies the PAYMENT-SIGNATURE header and settles
// after. Price is in USD and resolves to Circle USDC (the default Stellar asset).
app.use(
  paymentMiddleware(
    {
      "GET /joke": {
        accepts: {
          scheme: "exact",
          price: PRICE,
          network: NETWORK,
          payTo: PAY_TO,
        },
        description: "A random programming joke",
        mimeType: "application/json",
      },
    },
    resourceServer,
  ),
);

// --- the actual (paid) resource --------------------------------------------
app.get("/joke", (_req, res) => {
  const joke = jokes[Math.floor(Math.random() * jokes.length)];
  res.json({ joke });
});

app.listen(PORT, () => {
  console.log(`x402 joke server on http://localhost:${PORT}/joke  (${PRICE} USDC per call, ${NETWORK})`);
});
