# x402 Joke
The smallest thing that shows how [x402](https://x402.org) works: a server with one
paid endpoint, `GET /joke`, and a client that pays for it automatically with
**Circle USDC on Stellar**.

- **server.js** – Express + `@x402/express` + `@x402/stellar`. `GET /joke` returns a
  random joke from `jokes.json`, but only after a payment. Unpaid requests get
  `402 Payment Required`.
- **client.js** – `@x402/fetch` + `@x402/stellar`. Calls `/joke`, and when it sees
  the 402 it signs a USDC transfer authorization for the quoted price and retries.
- **jokes.json** – the joke list, read from disk on each request.

## How x402 works (what happens on one `npm run client`)

1. Client does `GET /joke` with no payment.
2. Server responds **HTTP 402** with a JSON body describing what it wants: scheme
   (`exact`), network (`stellar:testnet`), amount, `payTo` account, and the asset
   (Circle USDC).
3. Client builds a Soroban token-transfer authorization for that exact amount,
   signs it with its Stellar key, base64-encodes it, and repeats the request with a
   `PAYMENT-SIGNATURE` header.
4. Server hands the payment to the **facilitator**, which rebuilds the transaction,
   submits it to Stellar, and confirms settlement. The server itself never touches
   the network.
5. Server runs the real handler and returns the joke, plus a `PAYMENT-RESPONSE`
   header containing the settlement receipt.

## Setup

```bash
npm install
cp .env.example .env
```

### Create two Stellar testnet accounts

Do this for **both** a "server" (payee) and a "client" (payer) account:

1. [Stellar Laboratory → Create Account](https://lab.stellar.org/account/create) →
   Generate keypair → fund with Friendbot. Save the `Public Key` (`G...`) and
   `Secret Key` (`S...`).
2. Add a **USDC trustline** to each account:
   [Lab → Fund Account](https://lab.stellar.org/account/fund) → paste the public
   key → Add USDC Trustline → sign with the secret key.
3. Get test USDC for the **client** account from the
   [Circle faucet](https://faucet.circle.com/) (select the Stellar network).

Then fill in `.env`:

- `ADDRESS` – the server account's public key (`G...`), receives the payments.
- `PRIVATE_KEY` – the client account's secret key (`S...`), pays for jokes.

Defaults use `stellar:testnet` and the public facilitator at
`https://x402.org/facilitator`, so no real money is involved. For mainnet, set
`NETWORK=stellar:pubnet`.

## Run

Terminal 1:

```bash
npm run server
```

Terminal 2:

```bash
npm run client
```

Expected output from the client:

```
Joke: A SQL query walks into a bar, walks up to two tables and asks: 'Can I join you?'
Payment settled: { success: true, transaction: '...', network: 'stellar:testnet', ... }
```

To see the raw 402, call it without paying:

```bash
curl -i http://localhost:4021/joke
```
