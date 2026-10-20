# 01 — Base wallet explorer

A local page: paste any address, see its ETH balance, USDC balance, and recent transfers on Base.

## Why this is first

Every later project reads or writes chain data. This one teaches that skill with no Solidity and no private key. Remote app roles expect TypeScript and viem (or wagmi) on an EVM network, and Base shows up constantly in those listings.

## You will be able to show

A running page and a short note that the numbers match BaseScan for the same address.

## Stack

TypeScript, viem, a public Base RPC, a small web UI.

## Run

```bash
npm install
npm run dev
```

Open the local page. Try **Sample wallet**, then **Empty wallet**, then paste any address. Use **Open on BaseScan** and check that ETH and USDC match.

Recent transfers are USDC only, and only for about the last five hours. A free public node can answer “what is the balance right now?” but it does not keep a full history of every transfer. The balances are current either way.

The page never asks for a seed phrase or a private key.

## Done when

- `npm run dev` opens the page.
- A known address shows ETH and USDC balances that match the explorer.
- Recent USDC transfers render, including the empty-wallet case.
- The app only reads. It never asks for a seed phrase.
