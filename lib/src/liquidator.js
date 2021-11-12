"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
This will probably move to its own repo at some point but easier to keep it here for now
 */
const os = __importStar(require("os"));
const fs = __importStar(require("fs"));
const client_1 = require("./client");
const web3_js_1 = require("@gemachain/web3.js");
const utils_1 = require("./utils");
const ids_json_1 = __importDefault(require("./ids.json"));
const config_1 = require("./config");
const fixednum_1 = require("./fixednum");
const serum_1 = require("@project-serum/serum");
const bn_js_1 = __importDefault(require("bn.js"));
const layout_1 = require("./layout");
const _1 = require(".");
const market_1 = require("@project-serum/serum/lib/market");
const axios_1 = __importDefault(require("axios"));
const interval = parseInt(process.env.INTERVAL || '3500');
const refreshAccountsInterval = parseInt(process.env.INTERVAL || '120000');
const refreshWebsocketInterval = parseInt(process.env.INTERVAL || '300000');
const config = new config_1.Config(ids_json_1.default);
const cluster = (process.env.CLUSTER || 'mainnet');
const groupName = process.env.GROUP || 'mainnet.1';
const groupIds = config.getGroup(cluster, groupName);
if (!groupIds) {
    throw new Error(`Group ${groupName} not found`);
}
const TARGETS = [0, 0, 0, 0, 0, 0, 0];
const mangoProgramId = groupIds.mangoProgramId;
const mangoGroupKey = groupIds.publicKey;
const payer = new web3_js_1.Account(JSON.parse(fs.readFileSync(process.env.KEYPAIR || os.homedir() + '/.config/solana/my-mainnet.json', 'utf-8')));
console.log(`Payer: ${payer.publicKey.toBase58()}`);
const connection = new web3_js_1.Connection(process.env.ENDPOINT_URL || config.cluster_urls[cluster], 'processed');
const client = new client_1.MangoClient(connection, mangoProgramId);
let mangoAccounts = [];
let mangoSubscriptionId = -1;
let dexSubscriptionId = -1;
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!groupIds) {
            throw new Error(`Group ${groupName} not found`);
        }
        console.log(`Starting liquidator for ${groupName}...`);
        const liquidating = {};
        let numLiquidating = 0;
        const mangoGroup = yield client.getMangoGroup(mangoGroupKey);
        let cache = yield mangoGroup.loadCache(connection);
        let liqorMangoAccount;
        if (process.env.LIQOR_PK) {
            liqorMangoAccount = yield client.getMangoAccount(new web3_js_1.PublicKey(process.env.LIQOR_PK), mangoGroup.dexProgramId);
            if (!liqorMangoAccount.owner.equals(payer.publicKey)) {
                throw new Error('Account not owned by Keypair');
            }
        }
        else {
            let accounts = yield client.getMangoAccountsForOwner(mangoGroup, payer.publicKey, true);
            if (accounts.length) {
                accounts.sort((a, b) => b
                    .computeValue(mangoGroup, cache)
                    .sub(a.computeValue(mangoGroup, cache))
                    .toNumber());
                liqorMangoAccount = accounts[0];
            }
            else {
                throw new Error('No Mango Account found for this Keypair');
            }
        }
        console.log(`Liqor Public Key: ${liqorMangoAccount.publicKey.toBase58()}`);
        yield refreshAccounts(mangoGroup);
        watchAccounts(groupIds.mangoProgramId, mangoGroup);
        const perpMarkets = yield Promise.all(groupIds.perpMarkets.map((perpMarket) => {
            return mangoGroup.loadPerpMarket(connection, perpMarket.marketIndex, perpMarket.baseDecimals, perpMarket.quoteDecimals);
        }));
        const spotMarkets = yield Promise.all(groupIds.spotMarkets.map((spotMarket) => {
            return serum_1.Market.load(connection, spotMarket.publicKey, undefined, groupIds.serumProgramId);
        }));
        const rootBanks = yield mangoGroup.loadRootBanks(connection);
        notify(`V3 Liquidator launched for group ${groupName}`);
        // eslint-disable-next-line
        while (true) {
            try {
                cache = yield mangoGroup.loadCache(connection);
                yield liqorMangoAccount.reload(connection);
                for (let mangoAccount of mangoAccounts) {
                    const health = mangoAccount.getHealthRatio(mangoGroup, cache, 'Maint');
                    const mangoAccountKeyString = mangoAccount.publicKey.toBase58();
                    if (health.lt(fixednum_1.ZERO_I80F48)) {
                        if (!liquidating[mangoAccountKeyString] && numLiquidating < 1) {
                            yield mangoAccount.reload(connection, mangoGroup.dexProgramId);
                            if (!mangoAccount.getHealthRatio(mangoGroup, cache, 'Maint').lt(fixednum_1.ZERO_I80F48)) {
                                console.log(`Account ${mangoAccountKeyString} no longer liquidatable`);
                                continue;
                            }
                            liquidating[mangoAccountKeyString] = true;
                            numLiquidating++;
                            console.log(`Sick account ${mangoAccountKeyString} health: ${health.toString()}`);
                            notify(`Sick account ${mangoAccountKeyString} health: ${health.toString()}`);
                            console.log(mangoAccount.toPrettyString(groupIds, mangoGroup, cache));
                            liquidateAccount(mangoGroup, cache, spotMarkets, rootBanks, perpMarkets, mangoAccount, liqorMangoAccount)
                                .then(() => {
                                console.log('Liquidated account', mangoAccountKeyString);
                                notify(`Liquidated account ${mangoAccountKeyString}`);
                            })
                                .catch((err) => {
                                console.error('Failed to liquidate account', mangoAccountKeyString, err);
                                notify(`Failed to liquidate account ${mangoAccountKeyString}: ${err}`);
                            })
                                .finally(() => {
                                liquidating[mangoAccountKeyString] = false;
                                numLiquidating--;
                            });
                        }
                    }
                }
                yield utils_1.sleep(interval);
            }
            catch (err) {
                console.error('Error checking accounts:', err);
            }
        }
    });
}
function watchAccounts(mangoProgramId, mangoGroup) {
    try {
        console.log('Watching accounts...');
        const openOrdersAccountSpan = serum_1.OpenOrders.getLayout(mangoGroup.dexProgramId).span;
        const openOrdersAccountOwnerOffset = serum_1.OpenOrders.getLayout(mangoGroup.dexProgramId).offsetOf('owner');
        if (mangoSubscriptionId != -1) {
            connection.removeProgramAccountChangeListener(mangoSubscriptionId);
        }
        if (dexSubscriptionId != -1) {
            connection.removeProgramAccountChangeListener(dexSubscriptionId);
        }
        mangoSubscriptionId = connection.onProgramAccountChange(mangoProgramId, ({ accountId, accountInfo }) => {
            const mangoAccount = new _1.MangoAccount(accountId, layout_1.MangoAccountLayout.decode(accountInfo.data));
            const index = mangoAccounts.findIndex((account) => account.publicKey.equals(mangoAccount.publicKey));
            if (index == -1) {
                //console.log('New Account');
                mangoAccounts.push(mangoAccount);
            }
            else {
                mangoAccounts[index] = mangoAccount;
                //console.log('Updated account ' + accountId.toBase58());
            }
        }, 'singleGossip', [
            { dataSize: layout_1.MangoAccountLayout.span },
            {
                memcmp: {
                    offset: layout_1.MangoAccountLayout.offsetOf('mangoGroup'),
                    bytes: mangoGroup.publicKey.toBase58(),
                },
            },
        ]);
        dexSubscriptionId = connection.onProgramAccountChange(mangoGroup.dexProgramId, ({ accountId, accountInfo }) => {
            const ownerIndex = mangoAccounts.findIndex((account) => account.spotOpenOrders.some((key) => key.equals(accountId)));
            if (ownerIndex > -1) {
                const openOrdersIndex = mangoAccounts[ownerIndex].spotOpenOrders.findIndex((key) => key.equals(accountId));
                const openOrders = serum_1.OpenOrders.fromAccountInfo(accountId, accountInfo, mangoGroup.dexProgramId);
                mangoAccounts[ownerIndex].spotOpenOrdersAccounts[openOrdersIndex] =
                    openOrders;
                //console.log('Updated OpenOrders for account ' + mangoAccounts[ownerIndex].publicKey.toBase58());
            }
            else {
                console.error('Could not match OpenOrdersAccount to MangoAccount');
            }
        }, 'singleGossip', [
            { dataSize: openOrdersAccountSpan },
            {
                memcmp: {
                    offset: openOrdersAccountOwnerOffset,
                    bytes: mangoGroup.signerKey.toBase58(),
                },
            },
        ]);
    }
    catch (err) {
        console.error('Error watching accounts', err);
    }
    finally {
        setTimeout(watchAccounts, refreshWebsocketInterval, mangoProgramId, mangoGroup);
    }
}
function refreshAccounts(mangoGroup) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log('Refreshing accounts...');
            console.time('getAllMangoAccounts');
            mangoAccounts = yield client.getAllMangoAccounts(mangoGroup);
            console.timeEnd('getAllMangoAccounts');
            console.log(`Fetched ${mangoAccounts.length} accounts`);
        }
        catch (err) {
            console.error('Error reloading accounts', err);
        }
        finally {
            setTimeout(refreshAccounts, refreshAccountsInterval, mangoGroup);
        }
    });
}
function liquidateAccount(mangoGroup, cache, spotMarkets, rootBanks, perpMarkets, liqee, liqor) {
    return __awaiter(this, void 0, void 0, function* () {
        const hasPerpOpenOrders = liqee.perpAccounts.some((pa) => pa.bidsQuantity.gt(_1.ZERO_BN) || pa.asksQuantity.gt(_1.ZERO_BN));
        if (hasPerpOpenOrders) {
            console.log('forceCancelPerpOrders');
            yield Promise.all(perpMarkets.map((perpMarket) => {
                return client.forceCancelAllPerpOrdersInMarket(mangoGroup, liqee, perpMarket, payer, 10);
            }));
            yield utils_1.sleep(interval * 2);
        }
        yield liqee.reload(connection, mangoGroup.dexProgramId);
        if (!liqee.getHealthRatio(mangoGroup, cache, 'Maint').lt(fixednum_1.ZERO_I80F48)) {
            throw new Error('Account no longer liquidatable');
        }
        const healthComponents = liqee.getHealthComponents(mangoGroup, cache);
        const healths = liqee.getHealthsFromComponents(mangoGroup, cache, healthComponents.spot, healthComponents.perps, healthComponents.quote, 'Maint');
        let shouldLiquidateSpot = false;
        for (let i = 0; i < mangoGroup.tokens.length; i++) {
            const price = cache.priceCache[i] ? cache.priceCache[i].price : fixednum_1.ONE_I80F48;
            if (liqee
                .getNativeDeposit(cache.rootBankCache[i], i)
                .sub(liqee.getNativeBorrow(cache.rootBankCache[i], i))
                .mul(price)
                .lt(fixednum_1.ZERO_I80F48)) {
                shouldLiquidateSpot = true;
            }
        }
        if (shouldLiquidateSpot) {
            yield liquidateSpot(mangoGroup, cache, spotMarkets, rootBanks, liqee, liqor);
        }
        if (healths.perp.lt(fixednum_1.ZERO_I80F48)) {
            yield liquidatePerps(mangoGroup, cache, perpMarkets, rootBanks, liqee, liqor);
        }
    });
}
function liquidateSpot(mangoGroup, cache, spotMarkets, rootBanks, liqee, liqor) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('liquidateSpot');
        for (let i = 0; i < mangoGroup.spotMarkets.length; i++) {
            const spotMarket = spotMarkets[i];
            const baseRootBank = rootBanks[i];
            const quoteRootBank = rootBanks[layout_1.QUOTE_INDEX];
            if (baseRootBank && quoteRootBank) {
                if (liqee.inMarginBasket[i]) {
                    console.log('forceCancelOrders ', i);
                    yield client.forceCancelSpotOrders(mangoGroup, liqee, spotMarket, baseRootBank, quoteRootBank, payer, new bn_js_1.default(5));
                    yield utils_1.sleep(interval);
                }
            }
        }
        let minNet = fixednum_1.ZERO_I80F48;
        let minNetIndex = -1;
        let maxNet = fixednum_1.ZERO_I80F48;
        let maxNetIndex = layout_1.QUOTE_INDEX;
        for (let i = 0; i < mangoGroup.tokens.length; i++) {
            const price = cache.priceCache[i] ? cache.priceCache[i].price : fixednum_1.ONE_I80F48;
            const netDeposit = liqee
                .getNativeDeposit(cache.rootBankCache[i], i)
                .sub(liqee.getNativeBorrow(cache.rootBankCache[i], i))
                .mul(price);
            if (netDeposit.lt(minNet)) {
                minNet = netDeposit;
                minNetIndex = i;
            }
            else if (netDeposit.gt(maxNet)) {
                maxNet = netDeposit;
                maxNetIndex = i;
            }
        }
        if (minNetIndex == -1) {
            throw new Error('min net index neg 1');
        }
        if (minNetIndex == maxNetIndex) {
            maxNetIndex = 0;
        }
        const liabRootBank = rootBanks[minNetIndex];
        const assetRootBank = rootBanks[maxNetIndex];
        if (assetRootBank && liabRootBank) {
            const maxLiabTransfer = liqee.getNativeBorrow(liabRootBank, minNetIndex);
            if (liqee.isBankrupt) {
                console.log('Bankrupt account', liqee.publicKey.toBase58());
                const quoteRootBank = rootBanks[layout_1.QUOTE_INDEX];
                const maxLiabTransfer = liqee.getNativeBorrow(liabRootBank, minNetIndex);
                if (quoteRootBank) {
                    yield client.resolveTokenBankruptcy(mangoGroup, liqee, liqor, quoteRootBank, liabRootBank, payer, maxLiabTransfer);
                    yield liqee.reload(connection, mangoGroup.dexProgramId);
                }
            }
            else {
                yield client.liquidateTokenAndToken(mangoGroup, liqee, liqor, assetRootBank, liabRootBank, payer, maxLiabTransfer);
                yield liqee.reload(connection, mangoGroup.dexProgramId);
                if (liqee.isBankrupt) {
                    console.log('Bankrupt account', liqee.publicKey.toBase58());
                    const quoteRootBank = rootBanks[layout_1.QUOTE_INDEX];
                    const maxLiabTransfer = liqee.getNativeBorrow(liabRootBank, minNetIndex);
                    if (quoteRootBank) {
                        yield client.resolveTokenBankruptcy(mangoGroup, liqee, liqor, quoteRootBank, liabRootBank, payer, maxLiabTransfer);
                        yield liqee.reload(connection, mangoGroup.dexProgramId);
                    }
                }
            }
            yield balanceTokens(mangoGroup, liqor, spotMarkets);
        }
    });
}
function liquidatePerps(mangoGroup, cache, perpMarkets, rootBanks, liqee, liqor) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('liquidatePerps');
        const lowestHealthMarket = perpMarkets
            .map((perpMarket, i) => {
            const marketIndex = mangoGroup.getPerpMarketIndex(perpMarket.publicKey);
            const perpMarketInfo = mangoGroup.perpMarkets[marketIndex];
            const perpAccount = liqee.perpAccounts[marketIndex];
            const perpMarketCache = cache.perpMarketCache[marketIndex];
            const price = mangoGroup.getPrice(marketIndex, cache);
            const perpHealth = perpAccount.getHealth(perpMarketInfo, price, perpMarketInfo.maintAssetWeight, perpMarketInfo.maintLiabWeight, perpMarketCache.longFunding, perpMarketCache.shortFunding);
            return { perpHealth: perpHealth, marketIndex: marketIndex, i };
        })
            .sort((a, b) => {
            return a.perpHealth.sub(b.perpHealth).toNumber();
        })[0];
        if (!lowestHealthMarket) {
            throw new Error('Couldnt find a perp market to liquidate');
        }
        const marketIndex = lowestHealthMarket.marketIndex;
        const perpAccount = liqee.perpAccounts[marketIndex];
        const perpMarket = perpMarkets[lowestHealthMarket.i];
        const baseRootBank = rootBanks[marketIndex];
        if (!baseRootBank) {
            throw new Error(`Base root bank not found for ${marketIndex}`);
        }
        if (!perpMarket) {
            throw new Error(`Perp market not found for ${marketIndex}`);
        }
        if (liqee.isBankrupt) {
            const maxLiabTransfer = fixednum_1.I80F48.fromNumber(Math.max(Math.abs(perpAccount.quotePosition.toNumber()), 1));
            const quoteRootBank = rootBanks[layout_1.QUOTE_INDEX];
            if (quoteRootBank) {
                console.log('resolvePerpBankruptcy', maxLiabTransfer.toString());
                yield client.resolvePerpBankruptcy(mangoGroup, liqee, liqor, perpMarket, quoteRootBank, payer, marketIndex, maxLiabTransfer);
                yield liqee.reload(connection, mangoGroup.dexProgramId);
                return;
            }
        }
        if (lowestHealthMarket.perpHealth.lte(fixednum_1.ZERO_I80F48)) {
            let maxNet = fixednum_1.ZERO_I80F48;
            let maxNetIndex = mangoGroup.tokens.length - 1;
            for (let i = 0; i < mangoGroup.tokens.length; i++) {
                const price = cache.priceCache[i]
                    ? cache.priceCache[i].price
                    : fixednum_1.ONE_I80F48;
                const netDeposit = liqee
                    .getNativeDeposit(cache.rootBankCache[i], i)
                    .sub(liqee.getNativeBorrow(cache.rootBankCache[i], i))
                    .mul(price);
                if (netDeposit.gt(maxNet)) {
                    maxNet = netDeposit;
                    maxNetIndex = i;
                }
            }
            const assetRootBank = rootBanks[maxNetIndex];
            if (perpAccount.basePosition.eq(new bn_js_1.default(0))) {
                if (assetRootBank) {
                    console.log('liquidateTokenAndPerp ' + marketIndex);
                    yield client.liquidateTokenAndPerp(mangoGroup, liqee, liqor, assetRootBank, payer, 0 /* Token */, maxNetIndex, 1 /* Perp */, marketIndex, maxNet.sub(fixednum_1.ONE_I80F48).max(fixednum_1.ONE_I80F48));
                }
            }
            else {
                console.log('liquidatePerpMarket ' + marketIndex);
                const baseTransferRequest = perpAccount.basePosition;
                yield client.liquidatePerpMarket(mangoGroup, liqee, liqor, perpMarket, payer, baseTransferRequest);
            }
            yield utils_1.sleep(interval);
            yield liqee.reload(connection, mangoGroup.dexProgramId);
            if (liqee.isBankrupt) {
                const maxLiabTransfer = fixednum_1.I80F48.fromNumber(Math.abs(liqee.perpAccounts[marketIndex].quotePosition.toNumber()));
                const quoteRootBank = rootBanks[layout_1.QUOTE_INDEX];
                if (quoteRootBank) {
                    console.log('resolvePerpBankruptcy', maxLiabTransfer.toString());
                    yield client.resolvePerpBankruptcy(mangoGroup, liqee, liqor, perpMarket, quoteRootBank, payer, marketIndex, maxLiabTransfer);
                }
                yield liqee.reload(connection, mangoGroup.dexProgramId);
            }
            yield closePositions(mangoGroup, liqor, perpMarkets);
        }
    });
}
function balanceTokens(mangoGroup, mangoAccount, markets) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('balanceTokens');
        const cache = yield mangoGroup.loadCache(connection);
        const cancelOrdersPromises = [];
        const bidsInfo = yield _1.getMultipleAccounts(connection, markets.map((m) => m.bidsAddress));
        const bids = bidsInfo
            ? bidsInfo.map((o, i) => market_1.Orderbook.decode(markets[i], o.accountInfo.data))
            : [];
        const asksInfo = yield _1.getMultipleAccounts(connection, markets.map((m) => m.asksAddress));
        const asks = asksInfo
            ? asksInfo.map((o, i) => market_1.Orderbook.decode(markets[i], o.accountInfo.data))
            : [];
        for (let i = 0; i < markets.length; i++) {
            const orders = [...bids[i], ...asks[i]].filter((o) => o.openOrdersAddress.equals(mangoAccount.spotOpenOrders[i]));
            for (let order of orders) {
                cancelOrdersPromises.push(client.cancelSpotOrder(mangoGroup, mangoAccount, payer, markets[i], order));
            }
        }
        console.log('cancelling ' + cancelOrdersPromises.length + ' orders');
        yield Promise.all(cancelOrdersPromises);
        const openOrders = yield mangoAccount.loadOpenOrders(connection, mangoGroup.dexProgramId);
        const settlePromises = [];
        for (let i = 0; i < markets.length; i++) {
            const oo = openOrders[i];
            if (oo &&
                (oo.quoteTokenTotal.add(oo['referrerRebatesAccrued']).gt(new bn_js_1.default(0)) ||
                    oo.baseTokenTotal.gt(new bn_js_1.default(0)))) {
                settlePromises.push(client.settleFunds(mangoGroup, mangoAccount, payer, markets[i]));
            }
        }
        console.log('settling on ' + settlePromises.length + ' markets');
        yield Promise.all(settlePromises);
        const diffs = [];
        const netValues = [];
        // Go to each base currency and see if it's above or below target
        for (let i = 0; i < groupIds.spotMarkets.length; i++) {
            const diff = mangoAccount
                .getUiDeposit(cache.rootBankCache[i], mangoGroup, i)
                .sub(mangoAccount.getUiBorrow(cache.rootBankCache[i], mangoGroup, i))
                .sub(fixednum_1.I80F48.fromNumber(TARGETS[i]));
            diffs.push(diff);
            netValues.push([i, diff.mul(cache.priceCache[i].price)]);
        }
        netValues.sort((a, b) => b[1].sub(a[1]).toNumber());
        for (let i = 0; i < groupIds.spotMarkets.length; i++) {
            const marketIndex = netValues[i][0];
            const market = markets[marketIndex];
            if (Math.abs(diffs[marketIndex].toNumber()) > market.minOrderSize) {
                if (netValues[i][1].gt(fixednum_1.ZERO_I80F48)) {
                    // sell to close
                    const price = mangoGroup.getPrice(marketIndex, cache).mul(fixednum_1.I80F48.fromNumber(0.95));
                    console.log(`Sell to close ${marketIndex} ${Math.abs(diffs[marketIndex].toNumber())} @ ${price.toString()}`);
                    yield client.placeSpotOrder(mangoGroup, mangoAccount, mangoGroup.mangoCache, markets[marketIndex], payer, 'sell', price.toNumber(), Math.abs(diffs[marketIndex].toNumber()), 'ioc');
                    yield client.settleFunds(mangoGroup, mangoAccount, payer, markets[marketIndex]);
                }
                else if (netValues[i][1].lt(fixednum_1.ZERO_I80F48)) {
                    //buy to close
                    const price = mangoGroup.getPrice(marketIndex, cache).mul(fixednum_1.I80F48.fromNumber(1.05));
                    console.log(`Buy to close ${marketIndex} ${Math.abs(diffs[marketIndex].toNumber())} @ ${price.toString()}`);
                    yield client.placeSpotOrder(mangoGroup, mangoAccount, mangoGroup.mangoCache, markets[marketIndex], payer, 'buy', price.toNumber(), Math.abs(diffs[marketIndex].toNumber()), 'ioc');
                    yield client.settleFunds(mangoGroup, mangoAccount, payer, markets[marketIndex]);
                }
            }
        }
    });
}
function closePositions(mangoGroup, mangoAccount, perpMarkets) {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('closePositions');
        const cache = yield mangoGroup.loadCache(connection);
        for (let i = 0; i < perpMarkets.length; i++) {
            const perpMarket = perpMarkets[i];
            const index = mangoGroup.getPerpMarketIndex(perpMarket.publicKey);
            const perpAccount = mangoAccount.perpAccounts[index];
            if (perpMarket && perpAccount) {
                const basePositionSize = Math.abs(perpMarket.baseLotsToNumber(perpAccount.basePosition));
                const price = cache.priceCache[index].price;
                if (basePositionSize != 0) {
                    const side = perpAccount.basePosition.gt(_1.ZERO_BN) ? 'sell' : 'buy';
                    const liquidationFee = mangoGroup.perpMarkets[index].liquidationFee.toNumber();
                    const orderPrice = side == 'sell' ? price.toNumber() * 0.95 : price.toNumber() * 1.05; // TODO: base this on liquidation fee
                    console.log(side +
                        'ing ' +
                        basePositionSize +
                        ' of perp ' +
                        i +
                        ' for $' +
                        orderPrice);
                    yield client.placePerpOrder(mangoGroup, mangoAccount, cache.publicKey, perpMarket, payer, side, orderPrice, basePositionSize, 'ioc');
                }
                yield mangoAccount.reload(connection, mangoGroup.dexProgramId);
                if (!perpAccount.quotePosition.eq(fixednum_1.ZERO_I80F48)) {
                    const quoteRootBank = mangoGroup.rootBankAccounts[layout_1.QUOTE_INDEX];
                    if (quoteRootBank) {
                        yield client.settlePnl(mangoGroup, cache, mangoAccount, perpMarket, quoteRootBank, price, payer);
                    }
                }
            }
        }
    });
}
function notify(content) {
    if (content && process.env.WEBHOOK_URL) {
        try {
            axios_1.default.post(process.env.WEBHOOK_URL, { content });
        }
        catch (err) {
            console.error('Error posting to notify webhook:', err);
        }
    }
}
main();
//# sourceMappingURL=liquidator.js.map