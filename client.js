import "dotenv/config";
import { wrapFetchWithPayment, x402Client, decodePaymentResponseHeader } from "@x402/fetch";
import { createEd25519Signer } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";

// --- config ---------------------------------------------------------------
const URL = process.env.RESOURCE_URL || "http://localhost:4021/joke";
const NETWORK = process.env.NETWORK || "stellar:testnet";
const SECRET_KEY = process.env.PRIVATE_KEY; // Stellar secret key (S...), account holds test USDC

if (!SECRET_KEY) {
  console.error("Set PRIVATE_KEY in .env to the Stellar secret key (S...) that pays for jokes.");
  process.exit(1);
}

// --- x402 wiring --------------------------------------------------------------
// wrapFetchWithPayment intercepts a 402 response, signs a Soroban USDC transfer
// authorization for the quoted amount, and retries with a PAYMENT-SIGNATURE header.
const signer = createEd25519Signer(SECRET_KEY, NETWORK);
const client = new x402Client().register("stellar:*", new ExactStellarScheme(signer));
const fetchWithPayment = wrapFetchWithPayment(fetch, client);

// --- call the paid endpoint ------------------------------------------------
let res;
try {
  res = await fetchWithPayment(URL);
} catch (err) {
  // Thrown while building/signing the payment - usually the paying account has
  // no USDC trustline or no test USDC on this network.
  console.error("Could not complete payment:", err.message);
  console.error("Make sure the account has a USDC trustline and test USDC, then retry.");
  process.exit(1);
}

if (!res.ok) {
  // Still 402 here means the facilitator rejected the payment.
  console.error(`Request failed (${res.status}). Payment was not accepted.`);
  process.exit(1);
}

const data = await res.json();
console.log("Joke:", data.joke);

const receipt = res.headers.get("PAYMENT-RESPONSE");
if (receipt) {
  console.log("Payment settled:", decodePaymentResponseHeader(receipt));
}
