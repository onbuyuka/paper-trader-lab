# 📈 Paper Trader Lab

A no-money **paper-trading sandbox**. Build hypothetical portfolios, log buys and sells,
and track **profit & loss** against a daily price snapshot — then pit alternative portfolios
against each other and learn what actually moves them. Everything runs in your browser;
there's no backend and no real money involved.

> Educational sandbox, not investment advice. Prices may be delayed or approximate.

## What it does

- **Paper portfolios** — create as many as you like, each just a named bag of trades.
- **Buy & sell** — log trades for **any ticker** (search any stock, ETF or crypto by symbol
  or company name), with quantity, price, date and an optional fee. PnL uses the
  **average-cost** method (realized PnL is banked on sells; the rest is unrealized).
- **Compare** — every portfolio side by side: total return leaderboard, a detail table,
  and a market-value bar chart.
- **Multi-currency** — switch the whole app between **USD / EUR / TRY / GBP / DKK**; native
  prices are converted on the fly using live FX rates.
- **Your data stays yours** — state is saved in the browser (localStorage) and can be
  **exported / imported** as a JSON file. No accounts, no server.

## Develop

```bash
npm install
npm run dev          # http://localhost:3000/paper-trader-lab/
npm run build        # production build to dist/
npm run test         # run the PnL engine unit tests (vitest)
npm run fetch:prices # pull a fresh price snapshot into public/prices.json
npm run deploy       # build + publish dist/ to the gh-pages branch
```

Deployed as a GitHub Pages **project site**, so `vite.config.ts` sets
`base: '/paper-trader-lab/'` and the app uses a `HashRouter` (no server rewrites needed).

## Project structure

```
data/        universe.json — the tradable instrument list (single source of truth),
             instruments.ts (typed access + search)
utils/       portfolio.ts (average-cost holdings + display-currency summary),
             fx.ts (currency conversion), format.ts (money/percent), storage.ts
             (localStorage + export/import), id.ts, live.ts (in-browser quotes/search)
components/  PortfolioStore (state + actions), PriceStore (snapshot loader), Layout,
             PortfolioCard, AddTradeForm, HoldingsTable, TransactionsList,
             ImportExport, ui (shared primitives)
pages/       Home (portfolios), Portfolio (holdings + trades), Compare
scripts/     fetchPrices.mjs — pulls EOD quotes + FX from Yahoo into public/prices.json
public/      prices.json — the daily price snapshot read by the app at runtime
.github/     workflows/prices.yml — scheduled snapshot refresh (commits to gh-pages)
test/        engine.test.ts — unit tests for the PnL engine and FX conversion
```

## Prices & data

There are two layers, both keyless:

1. **Daily snapshot (offline baseline).** [`scripts/fetchPrices.mjs`](scripts/fetchPrices.mjs)
   reads every instrument in [`data/universe.json`](data/universe.json), pulls each last
   close from [Yahoo Finance](https://finance.yahoo.com) (plus the `EUR/USD`, `GBP/USD`,
   `USD/TRY` and `USD/DKK` pairs for the FX map) and writes a compact
   [`public/prices.json`](public/prices.json). A scheduled GitHub Action
   ([`.github/workflows/prices.yml`](.github/workflows/prices.yml)) re-runs it after the US
   close and commits the JSON straight to `gh-pages` — no rebuild, no secret. This ships as
   a seed so the app works on first paint and offline.
2. **Live quotes for any ticker (in-browser).** [`utils/live.ts`](utils/live.ts) lets the
   running app search **any** stock/ETF/crypto on Yahoo and fetch live quotes + FX for any
   ticker you hold that isn't already in the snapshot, then overlays them on the snapshot.
   Because a static site can't call Yahoo directly (CORS), requests go through a small chain
   of public CORS proxies (`corsproxy.io`, `codetabs`, `allorigins`) — the first that
   responds wins. Only public market data is ever requested; if every proxy or Yahoo is
   unavailable, the app silently falls back to the committed snapshot.

### Adding a ticker

You can trade **any** ticker straight from the app — just search for it in the trade form
(it resolves live via Yahoo). Adding a row to [`data/universe.json`](data/universe.json) is
only needed to include a name in the **daily snapshot** (so it has an offline price and
shows in search without a network call):

```json
{ "symbol": "TSLA", "name": "Tesla Inc.", "currency": "USD", "yahoo": "TSLA", "kind": "stock" }
```

`symbol` is what users see; `yahoo` is the symbol used to fetch prices (US tickers are
plain, e.g. `TSLA`; non-US add a suffix like `RHM.DE` for Frankfurt or `NVO.CO` for
Copenhagen). It's picked up by the next snapshot automatically.

## How PnL is calculated

- **Average cost** per symbol: buys add `price × qty + fee` to the cost basis; sells bank
  `(sellPrice − avgCost) × qtySold − fee` as **realized** PnL and reduce the basis
  proportionally.
- **Unrealized** PnL is `marketValue − costBasis` on the open quantity, using the latest
  snapshot price.
- **Currency-aware.** Each trade locks the FX rate at its trade date (`fxAtTrade`), so a
  position's **cost basis** is converted at the historical rate while its **market value**
  uses today's rate — the gap reflects real currency gains/losses. Viewing a holding in its
  own native currency shows pure price performance (no FX noise); viewing it in another
  currency surfaces the FX move. Past-dated trades fetch the historical rate automatically.

An independent hobby project. Ticker data is used for a non-commercial educational tool.
