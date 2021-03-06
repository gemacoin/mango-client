"use strict";
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
exports.MangoClient = exports.getUnixTs = void 0;
const web3_js_1 = require("@gemachain/web3.js");
const bn_js_1 = __importDefault(require("bn.js"));
const utils_1 = require("./utils");
const layout_1 = require("./layout");
const MangoAccount_1 = __importDefault(require("./MangoAccount"));
const PerpMarket_1 = __importDefault(require("./PerpMarket"));
const instruction_1 = require("./instruction");
const serum_1 = require("@project-serum/serum");
const fixednum_1 = require("./fixednum");
const book_1 = require("./book");
const token_instructions_1 = require("@project-serum/serum/lib/token-instructions");
const spl_token_1 = require("@gemachain/gpl-token");
const MangoGroup_1 = __importDefault(require("./MangoGroup"));
const _1 = require(".");
const getUnixTs = () => {
    return new Date().getTime() / 1000;
};
exports.getUnixTs = getUnixTs;
class MangoClient {
    constructor(connection, programId) {
        this.connection = connection;
        this.programId = programId;
    }
    sendTransactions(transactions, payer, additionalSigners, timeout = 30000, confirmLevel = 'confirmed') {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Promise.all(transactions.map((tx) => this.sendTransaction(tx, payer, additionalSigners, timeout, confirmLevel)));
        });
    }
    signTransaction({ transaction, payer, signers }) {
        return __awaiter(this, void 0, void 0, function* () {
            transaction.recentBlockhash = (yield this.connection.getRecentBlockhash()).blockhash;
            transaction.setSigners(payer.publicKey, ...signers.map((s) => s.publicKey));
            if (signers.length > 0) {
                transaction.partialSign(...signers);
            }
            if (payer === null || payer === void 0 ? void 0 : payer.connected) {
                console.log('signing as wallet', payer.publicKey);
                return yield payer.signTransaction(transaction);
            }
            else {
                transaction.sign(...[payer].concat(signers));
            }
        });
    }
    signTransactions({ transactionsAndSigners, payer, }) {
        return __awaiter(this, void 0, void 0, function* () {
            const blockhash = (yield this.connection.getRecentBlockhash('max'))
                .blockhash;
            transactionsAndSigners.forEach(({ transaction, signers = [] }) => {
                transaction.recentBlockhash = blockhash;
                transaction.setSigners(payer.publicKey, ...signers.map((s) => s.publicKey));
                if ((signers === null || signers === void 0 ? void 0 : signers.length) > 0) {
                    transaction.partialSign(...signers);
                }
            });
            if (!(payer instanceof web3_js_1.Account)) {
                return yield payer.signAllTransactions(transactionsAndSigners.map(({ transaction }) => transaction));
            }
            else {
                transactionsAndSigners.forEach(({ transaction, signers }) => {
                    // @ts-ignore
                    transaction.sign(...[payer].concat(signers));
                });
            }
        });
    }
    // TODO - switch Account to Keypair and switch off setSigners due to deprecated
    sendTransaction(transaction, payer, additionalSigners, timeout = 30000, confirmLevel = 'processed', postSignTxCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.signTransaction({
                transaction,
                payer,
                signers: additionalSigners,
            });
            const rawTransaction = transaction.serialize();
            const startTime = exports.getUnixTs();
            if (postSignTxCallback) {
                try {
                    postSignTxCallback();
                }
                catch (e) {
                    console.log(`postSignTxCallback error ${e}`);
                }
            }
            const txid = yield this.connection.sendRawTransaction(rawTransaction, { skipPreflight: true });
            console.log('Started awaiting confirmation for', txid, 'size:', rawTransaction.length);
            let done = false;
            (() => __awaiter(this, void 0, void 0, function* () {
                // TODO - make sure this works well on mainnet
                yield utils_1.sleep(1000);
                while (!done && exports.getUnixTs() - startTime < timeout / 1000) {
                    console.log(new Date().toUTCString(), ' sending tx ', txid);
                    this.connection.sendRawTransaction(rawTransaction, {
                        skipPreflight: true,
                    });
                    yield utils_1.sleep(2000);
                }
            }))();
            try {
                yield utils_1.awaitTransactionSignatureConfirmation(txid, timeout, this.connection, confirmLevel);
            }
            catch (err) {
                if (err.timeout) {
                    throw new Error('Timed out awaiting confirmation on transaction');
                }
                let simulateResult = null;
                try {
                    simulateResult = (yield utils_1.simulateTransaction(this.connection, transaction, 'processed')).value;
                }
                catch (e) {
                    console.warn('Simulate transaction failed');
                }
                if (simulateResult && simulateResult.err) {
                    if (simulateResult.logs) {
                        for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
                            const line = simulateResult.logs[i];
                            if (line.startsWith('Program log: ')) {
                                throw new Error('Transaction failed: ' + line.slice('Program log: '.length));
                            }
                        }
                    }
                    throw new Error(JSON.stringify(simulateResult.err));
                }
                throw new Error('Transaction failed');
            }
            finally {
                done = true;
            }
            // console.log('Latency', txid, getUnixTs() - startTime);
            return txid;
        });
    }
    sendSignedTransaction({ signedTransaction, timeout = 30000, confirmLevel = 'processed', }) {
        return __awaiter(this, void 0, void 0, function* () {
            const rawTransaction = signedTransaction.serialize();
            const startTime = exports.getUnixTs();
            const txid = yield this.connection.sendRawTransaction(rawTransaction, {
                skipPreflight: true,
            });
            // console.log('Started awaiting confirmation for', txid);
            let done = false;
            (() => __awaiter(this, void 0, void 0, function* () {
                yield utils_1.sleep(500);
                while (!done && exports.getUnixTs() - startTime < timeout) {
                    this.connection.sendRawTransaction(rawTransaction, {
                        skipPreflight: true,
                    });
                    yield utils_1.sleep(500);
                }
            }))();
            try {
                yield utils_1.awaitTransactionSignatureConfirmation(txid, timeout, this.connection, confirmLevel);
            }
            catch (err) {
                if (err.timeout) {
                    throw new Error('Timed out awaiting confirmation on transaction');
                }
                let simulateResult = null;
                try {
                    simulateResult = (yield utils_1.simulateTransaction(this.connection, signedTransaction, 'single')).value;
                }
                catch (e) {
                    console.log('Simulate tx failed');
                }
                if (simulateResult && simulateResult.err) {
                    if (simulateResult.logs) {
                        for (let i = simulateResult.logs.length - 1; i >= 0; --i) {
                            const line = simulateResult.logs[i];
                            if (line.startsWith('Program log: ')) {
                                throw new Error('Transaction failed: ' + line.slice('Program log: '.length));
                            }
                        }
                    }
                    throw new Error(JSON.stringify(simulateResult.err));
                }
                throw new Error('Transaction failed');
            }
            finally {
                done = true;
            }
            // console.log('Latency', txid, getUnixTs() - startTime);
            return txid;
        });
    }
    initMangoGroup(quoteMint, msrmMint, dexProgram, feesVault, // owned by Mango DAO token governance
    validInterval, quoteOptimalUtil, quoteOptimalRate, quoteMaxRate, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInstruction = yield utils_1.createAccountInstruction(this.connection, payer.publicKey, layout_1.MangoGroupLayout.span, this.programId);
            const { signerKey, signerNonce } = yield utils_1.createSignerKeyAndNonce(this.programId, accountInstruction.account.publicKey);
            const quoteVaultAccount = new web3_js_1.Account();
            const quoteVaultAccountInstructions = yield utils_1.createTokenAccountInstructions(this.connection, payer.publicKey, quoteVaultAccount.publicKey, quoteMint, signerKey);
            const insuranceVaultAccount = new web3_js_1.Account();
            const insuranceVaultAccountInstructions = yield utils_1.createTokenAccountInstructions(this.connection, payer.publicKey, insuranceVaultAccount.publicKey, quoteMint, signerKey);
            const quoteNodeBankAccountInstruction = yield utils_1.createAccountInstruction(this.connection, payer.publicKey, layout_1.NodeBankLayout.span, this.programId);
            const quoteRootBankAccountInstruction = yield utils_1.createAccountInstruction(this.connection, payer.publicKey, layout_1.RootBankLayout.span, this.programId);
            const cacheAccountInstruction = yield utils_1.createAccountInstruction(this.connection, payer.publicKey, layout_1.MangoCacheLayout.span, this.programId);
            const createAccountsTransaction = new web3_js_1.Transaction();
            createAccountsTransaction.add(accountInstruction.instruction);
            createAccountsTransaction.add(...quoteVaultAccountInstructions);
            createAccountsTransaction.add(quoteNodeBankAccountInstruction.instruction);
            createAccountsTransaction.add(quoteRootBankAccountInstruction.instruction);
            createAccountsTransaction.add(cacheAccountInstruction.instruction);
            createAccountsTransaction.add(...insuranceVaultAccountInstructions);
            const signers = [
                accountInstruction.account,
                quoteVaultAccount,
                quoteNodeBankAccountInstruction.account,
                quoteRootBankAccountInstruction.account,
                cacheAccountInstruction.account,
                insuranceVaultAccount,
            ];
            yield this.sendTransaction(createAccountsTransaction, payer, signers);
            // If valid msrmMint passed in, then create new msrmVault
            let msrmVaultPk;
            if (!msrmMint.equals(utils_1.zeroKey)) {
                const msrmVaultAccount = new web3_js_1.Account();
                const msrmVaultAccountInstructions = yield utils_1.createTokenAccountInstructions(this.connection, payer.publicKey, msrmVaultAccount.publicKey, msrmMint, signerKey);
                const createMsrmVaultTransaction = new web3_js_1.Transaction();
                createMsrmVaultTransaction.add(...msrmVaultAccountInstructions);
                msrmVaultPk = msrmVaultAccount.publicKey;
                yield this.sendTransaction(createMsrmVaultTransaction, payer, [
                    msrmVaultAccount,
                ]);
            }
            else {
                msrmVaultPk = utils_1.zeroKey;
            }
            const initMangoGroupInstruction = instruction_1.makeInitMangoGroupInstruction(this.programId, accountInstruction.account.publicKey, signerKey, payer.publicKey, quoteMint, quoteVaultAccount.publicKey, quoteNodeBankAccountInstruction.account.publicKey, quoteRootBankAccountInstruction.account.publicKey, insuranceVaultAccount.publicKey, msrmVaultPk, feesVault, cacheAccountInstruction.account.publicKey, dexProgram, new bn_js_1.default(signerNonce), new bn_js_1.default(validInterval), fixednum_1.I80F48.fromNumber(quoteOptimalUtil), fixednum_1.I80F48.fromNumber(quoteOptimalRate), fixednum_1.I80F48.fromNumber(quoteMaxRate));
            const initMangoGroupTransaction = new web3_js_1.Transaction();
            initMangoGroupTransaction.add(initMangoGroupInstruction);
            yield this.sendTransaction(initMangoGroupTransaction, payer, []);
            return accountInstruction.account.publicKey;
        });
    }
    getMangoGroup(mangoGroup) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInfo = yield this.connection.getAccountInfo(mangoGroup);
            const decoded = layout_1.MangoGroupLayout.decode(accountInfo == null ? undefined : accountInfo.data);
            return new MangoGroup_1.default(mangoGroup, decoded);
        });
    }
    initMangoAccount(mangoGroup, owner) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountInstruction = yield utils_1.createAccountInstruction(this.connection, owner.publicKey, layout_1.MangoAccountLayout.span, this.programId);
            const initMangoAccountInstruction = instruction_1.makeInitMangoAccountInstruction(this.programId, mangoGroup.publicKey, accountInstruction.account.publicKey, owner.publicKey);
            // Add all instructions to one atomic transaction
            const transaction = new web3_js_1.Transaction();
            transaction.add(accountInstruction.instruction);
            transaction.add(initMangoAccountInstruction);
            const additionalSigners = [accountInstruction.account];
            yield this.sendTransaction(transaction, owner, additionalSigners);
            return accountInstruction.account.publicKey;
        });
    }
    getMangoAccount(mangoAccountPk, dexProgramId) {
        return __awaiter(this, void 0, void 0, function* () {
            const acc = yield this.connection.getAccountInfo(mangoAccountPk, 'processed');
            const mangoAccount = new MangoAccount_1.default(mangoAccountPk, layout_1.MangoAccountLayout.decode(acc == null ? undefined : acc.data));
            yield mangoAccount.loadOpenOrders(this.connection, dexProgramId);
            return mangoAccount;
        });
    }
    initMangoAccountAndDeposit(mangoGroup, owner, rootBank, nodeBank, vault, tokenAcc, quantity, info) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const accountInstruction = yield utils_1.createAccountInstruction(this.connection, owner.publicKey, layout_1.MangoAccountLayout.span, this.programId);
            const initMangoAccountInstruction = instruction_1.makeInitMangoAccountInstruction(this.programId, mangoGroup.publicKey, accountInstruction.account.publicKey, owner.publicKey);
            transaction.add(accountInstruction.instruction);
            transaction.add(initMangoAccountInstruction);
            const additionalSigners = [accountInstruction.account];
            const tokenIndex = mangoGroup.getRootBankIndex(rootBank);
            const tokenMint = mangoGroup.tokens[tokenIndex].mint;
            let wrappedSolAccount = null;
            if (tokenMint.equals(token_instructions_1.WRAPPED_SOL_MINT) &&
                tokenAcc.toBase58() === owner.publicKey.toBase58()) {
                wrappedSolAccount = new web3_js_1.Account();
                const carats = Math.round(quantity * web3_js_1.CARATS_PER_GEMA) + 1e7;
                transaction.add(web3_js_1.SystemProgram.createAccount({
                    fromPubkey: owner.publicKey,
                    newAccountPubkey: wrappedSolAccount.publicKey,
                    carats,
                    space: 165,
                    programId: spl_token_1.TOKEN_PROGRAM_ID,
                }));
                transaction.add(token_instructions_1.initializeAccount({
                    account: wrappedSolAccount.publicKey,
                    mint: token_instructions_1.WRAPPED_SOL_MINT,
                    owner: owner.publicKey,
                }));
                additionalSigners.push(wrappedSolAccount);
            }
            const nativeQuantity = utils_1.uiToNative(quantity, mangoGroup.tokens[tokenIndex].decimals);
            const instruction = instruction_1.makeDepositInstruction(this.programId, mangoGroup.publicKey, owner.publicKey, mangoGroup.mangoCache, accountInstruction.account.publicKey, rootBank, nodeBank, vault, (_a = wrappedSolAccount === null || wrappedSolAccount === void 0 ? void 0 : wrappedSolAccount.publicKey) !== null && _a !== void 0 ? _a : tokenAcc, nativeQuantity);
            transaction.add(instruction);
            if (info) {
                const addAccountNameinstruction = instruction_1.makeAddMangoAccountInfoInstruction(this.programId, mangoGroup.publicKey, accountInstruction.account.publicKey, owner.publicKey, info);
                transaction.add(addAccountNameinstruction);
            }
            if (wrappedSolAccount) {
                transaction.add(token_instructions_1.closeAccount({
                    source: wrappedSolAccount.publicKey,
                    destination: owner.publicKey,
                    owner: owner.publicKey,
                }));
            }
            yield this.sendTransaction(transaction, owner, additionalSigners);
            return accountInstruction.account.publicKey.toString();
        });
    }
    deposit(mangoGroup, mangoAccount, owner, rootBank, nodeBank, vault, tokenAcc, quantity) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const additionalSigners = [];
            const tokenIndex = mangoGroup.getRootBankIndex(rootBank);
            const tokenMint = mangoGroup.tokens[tokenIndex].mint;
            let wrappedSolAccount = null;
            if (tokenMint.equals(token_instructions_1.WRAPPED_SOL_MINT) &&
                tokenAcc.toBase58() === owner.publicKey.toBase58()) {
                wrappedSolAccount = new web3_js_1.Account();
                const carats = Math.round(quantity * web3_js_1.CARATS_PER_GEMA) + 1e7;
                transaction.add(web3_js_1.SystemProgram.createAccount({
                    fromPubkey: owner.publicKey,
                    newAccountPubkey: wrappedSolAccount.publicKey,
                    carats,
                    space: 165,
                    programId: spl_token_1.TOKEN_PROGRAM_ID,
                }));
                transaction.add(token_instructions_1.initializeAccount({
                    account: wrappedSolAccount.publicKey,
                    mint: token_instructions_1.WRAPPED_SOL_MINT,
                    owner: owner.publicKey,
                }));
                additionalSigners.push(wrappedSolAccount);
            }
            const nativeQuantity = utils_1.uiToNative(quantity, mangoGroup.tokens[tokenIndex].decimals);
            const instruction = instruction_1.makeDepositInstruction(this.programId, mangoGroup.publicKey, owner.publicKey, mangoGroup.mangoCache, mangoAccount.publicKey, rootBank, nodeBank, vault, (_a = wrappedSolAccount === null || wrappedSolAccount === void 0 ? void 0 : wrappedSolAccount.publicKey) !== null && _a !== void 0 ? _a : tokenAcc, nativeQuantity);
            transaction.add(instruction);
            if (wrappedSolAccount) {
                transaction.add(token_instructions_1.closeAccount({
                    source: wrappedSolAccount.publicKey,
                    destination: owner.publicKey,
                    owner: owner.publicKey,
                }));
            }
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    withdraw(mangoGroup, mangoAccount, owner, rootBank, nodeBank, vault, quantity, allowBorrow) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const additionalSigners = [];
            const tokenIndex = mangoGroup.getRootBankIndex(rootBank);
            const tokenMint = mangoGroup.tokens[tokenIndex].mint;
            let tokenAcc = yield spl_token_1.Token.getAssociatedTokenAddress(spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID, spl_token_1.TOKEN_PROGRAM_ID, tokenMint, owner.publicKey);
            let wrappedSolAccount = null;
            if (tokenMint.equals(token_instructions_1.WRAPPED_SOL_MINT)) {
                wrappedSolAccount = new web3_js_1.Account();
                tokenAcc = wrappedSolAccount.publicKey;
                const space = 165;
                const carats = yield this.connection.getMinimumBalanceForRentExemption(space, 'processed');
                transaction.add(web3_js_1.SystemProgram.createAccount({
                    fromPubkey: owner.publicKey,
                    newAccountPubkey: tokenAcc,
                    carats,
                    space,
                    programId: spl_token_1.TOKEN_PROGRAM_ID,
                }));
                transaction.add(token_instructions_1.initializeAccount({
                    account: tokenAcc,
                    mint: token_instructions_1.WRAPPED_SOL_MINT,
                    owner: owner.publicKey,
                }));
                additionalSigners.push(wrappedSolAccount);
            }
            else {
                const tokenAccExists = yield this.connection.getAccountInfo(tokenAcc, 'recent');
                if (!tokenAccExists) {
                    transaction.add(spl_token_1.Token.createAssociatedTokenAccountInstruction(spl_token_1.ASSOCIATED_TOKEN_PROGRAM_ID, spl_token_1.TOKEN_PROGRAM_ID, tokenMint, tokenAcc, owner.publicKey, owner.publicKey));
                }
            }
            const nativeQuantity = utils_1.uiToNative(quantity, mangoGroup.tokens[tokenIndex].decimals);
            const instruction = instruction_1.makeWithdrawInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoGroup.mangoCache, rootBank, nodeBank, vault, tokenAcc, mangoGroup.signerKey, mangoAccount.spotOpenOrders, nativeQuantity, allowBorrow);
            transaction.add(instruction);
            if (wrappedSolAccount) {
                transaction.add(token_instructions_1.closeAccount({
                    source: wrappedSolAccount.publicKey,
                    destination: owner.publicKey,
                    owner: owner.publicKey,
                }));
            }
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    // Keeper functions
    cacheRootBanks(mangoGroup, mangoCache, rootBanks, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const cacheRootBanksInstruction = instruction_1.makeCacheRootBankInstruction(this.programId, mangoGroup, mangoCache, rootBanks);
            const transaction = new web3_js_1.Transaction();
            transaction.add(cacheRootBanksInstruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    cachePrices(mangoGroup, mangoCache, oracles, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const cachePricesInstruction = instruction_1.makeCachePricesInstruction(this.programId, mangoGroup, mangoCache, oracles);
            const transaction = new web3_js_1.Transaction();
            transaction.add(cachePricesInstruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    cachePerpMarkets(mangoGroup, mangoCache, perpMarkets, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const cachePerpMarketsInstruction = instruction_1.makeCachePerpMarketsInstruction(this.programId, mangoGroup, mangoCache, perpMarkets);
            const transaction = new web3_js_1.Transaction();
            transaction.add(cachePerpMarketsInstruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    updateRootBank(mangoGroup, rootBank, nodeBanks, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const updateRootBanksInstruction = instruction_1.makeUpdateRootBankInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, rootBank, nodeBanks);
            const transaction = new web3_js_1.Transaction();
            transaction.add(updateRootBanksInstruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    consumeEvents(mangoGroup, perpMarket, mangoAccounts, payer, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const consumeEventsInstruction = instruction_1.makeConsumeEventsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.eventQueue, mangoAccounts, limit);
            const transaction = new web3_js_1.Transaction();
            transaction.add(consumeEventsInstruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    updateFunding(mangoGroup, mangoCache, perpMarket, bids, asks, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const updateFundingInstruction = instruction_1.makeUpdateFundingInstruction(this.programId, mangoGroup, mangoCache, perpMarket, bids, asks);
            const transaction = new web3_js_1.Transaction();
            transaction.add(updateFundingInstruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    getPerpMarket(perpMarketPk, baseDecimal, quoteDecimal) {
        return __awaiter(this, void 0, void 0, function* () {
            const acc = yield this.connection.getAccountInfo(perpMarketPk);
            const perpMarket = new PerpMarket_1.default(perpMarketPk, baseDecimal, quoteDecimal, layout_1.PerpMarketLayout.decode(acc === null || acc === void 0 ? void 0 : acc.data));
            return perpMarket;
        });
    }
    placePerpOrder(mangoGroup, mangoAccount, mangoCache, perpMarket, owner, side, price, quantity, orderType, clientOrderId = 0, bookSideInfo) {
        return __awaiter(this, void 0, void 0, function* () {
            const marketIndex = mangoGroup.getPerpMarketIndex(perpMarket.publicKey);
            // TODO: this will not work for perp markets without spot market
            const baseTokenInfo = mangoGroup.tokens[marketIndex];
            const quoteTokenInfo = mangoGroup.tokens[layout_1.QUOTE_INDEX];
            const baseUnit = Math.pow(10, baseTokenInfo.decimals);
            const quoteUnit = Math.pow(10, quoteTokenInfo.decimals);
            const nativePrice = new bn_js_1.default(price * quoteUnit)
                .mul(perpMarket.baseLotSize)
                .div(perpMarket.quoteLotSize.mul(new bn_js_1.default(baseUnit)));
            const nativeQuantity = new bn_js_1.default(quantity * baseUnit).div(perpMarket.baseLotSize);
            const transaction = new web3_js_1.Transaction();
            const additionalSigners = [];
            const instruction = instruction_1.makePlacePerpOrderInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoCache, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, perpMarket.eventQueue, mangoAccount.spotOpenOrders, nativePrice, nativeQuantity, new bn_js_1.default(clientOrderId), side, orderType);
            transaction.add(instruction);
            if (bookSideInfo) {
                const bookSide = bookSideInfo.data
                    ? new book_1.BookSide(side === 'buy' ? perpMarket.asks : perpMarket.bids, perpMarket, layout_1.BookSideLayout.decode(bookSideInfo.data))
                    : [];
                const accounts = new Set();
                accounts.add(mangoAccount.publicKey.toBase58());
                for (const order of bookSide) {
                    accounts.add(order.owner.toBase58());
                    if (accounts.size >= 10) {
                        break;
                    }
                }
                const consumeInstruction = instruction_1.makeConsumeEventsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.eventQueue, Array.from(accounts)
                    .map((s) => new web3_js_1.PublicKey(s))
                    .sort(), new bn_js_1.default(4));
                transaction.add(consumeInstruction);
            }
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    cancelPerpOrder(mangoGroup, mangoAccount, owner, perpMarket, order, invalidIdOk = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeCancelPerpOrderInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, order, invalidIdOk);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    /*
    async loadPerpMarkets(perpMarkets: PublicKey[]): Promise<PerpMarket[]> {
      const accounts = await Promise.all(
        perpMarkets.map((pk) => this.connection.getAccountInfo(pk)),
      );
  
      const parsedPerpMarkets: PerpMarket[] = [];
  
      for (let i = 0; i < accounts.length; i++) {
        const acc = accounts[i];
        if (acc) {
          const decoded = PerpMarketLayout.decode(acc.data);
          parsedPerpMarkets.push(new PerpMarket(perpMarkets[i], decoded));
        }
      }
  
      return parsedPerpMarkets;
    }
    */
    addOracle(mangoGroup, oracle, admin) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeAddOracleInstruction(this.programId, mangoGroup.publicKey, oracle, admin.publicKey);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    setOracle(mangoGroup, oracle, admin, price) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeSetOracleInstruction(this.programId, mangoGroup.publicKey, oracle, admin.publicKey, price);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    addSpotMarket(mangoGroup, oracle, spotMarket, mint, admin, maintLeverage, initLeverage, liquidationFee, optimalUtil, optimalRate, maxRate) {
        return __awaiter(this, void 0, void 0, function* () {
            const vaultAccount = new web3_js_1.Account();
            const vaultAccountInstructions = yield utils_1.createTokenAccountInstructions(this.connection, admin.publicKey, vaultAccount.publicKey, mint, mangoGroup.signerKey);
            const nodeBankAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.NodeBankLayout.span, this.programId);
            const rootBankAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.RootBankLayout.span, this.programId);
            const instruction = instruction_1.makeAddSpotMarketInstruction(this.programId, mangoGroup.publicKey, oracle, spotMarket, mangoGroup.dexProgramId, mint, nodeBankAccountInstruction.account.publicKey, vaultAccount.publicKey, rootBankAccountInstruction.account.publicKey, admin.publicKey, fixednum_1.I80F48.fromNumber(maintLeverage), fixednum_1.I80F48.fromNumber(initLeverage), fixednum_1.I80F48.fromNumber(liquidationFee), fixednum_1.I80F48.fromNumber(optimalUtil), fixednum_1.I80F48.fromNumber(optimalRate), fixednum_1.I80F48.fromNumber(maxRate));
            const transaction = new web3_js_1.Transaction();
            transaction.add(...vaultAccountInstructions);
            transaction.add(nodeBankAccountInstruction.instruction);
            transaction.add(rootBankAccountInstruction.instruction);
            transaction.add(instruction);
            const additionalSigners = [
                vaultAccount,
                nodeBankAccountInstruction.account,
                rootBankAccountInstruction.account,
            ];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    /**
     * Make sure mangoAccount has recent and valid inMarginBasket and spotOpenOrders
     */
    placeSpotOrder(mangoGroup, mangoAccount, mangoCache, spotMarket, owner, side, price, size, orderType, clientId) {
        return __awaiter(this, void 0, void 0, function* () {
            const limitPrice = spotMarket.priceNumberToLots(price);
            const maxBaseQuantity = spotMarket.baseSizeNumberToLots(size);
            // TODO implement srm vault fee discount
            // const feeTier = getFeeTier(0, nativeToUi(mangoGroup.nativeSrm || 0, SRM_DECIMALS));
            const feeTier = serum_1.getFeeTier(0, utils_1.nativeToUi(0, 0));
            const rates = serum_1.getFeeRates(feeTier);
            const maxQuoteQuantity = new bn_js_1.default(spotMarket['_decoded'].quoteLotSize.toNumber() * (1 + rates.taker)).mul(spotMarket
                .baseSizeNumberToLots(size)
                .mul(spotMarket.priceNumberToLots(price)));
            if (maxBaseQuantity.lte(utils_1.ZERO_BN)) {
                throw new Error('size too small');
            }
            if (limitPrice.lte(utils_1.ZERO_BN)) {
                throw new Error('invalid price');
            }
            const selfTradeBehavior = 'decrementTake';
            clientId = clientId !== null && clientId !== void 0 ? clientId : new bn_js_1.default(Date.now());
            const spotMarketIndex = mangoGroup.getSpotMarketIndex(spotMarket.publicKey);
            if (!mangoGroup.rootBankAccounts.filter((a) => !!a).length) {
                yield mangoGroup.loadRootBanks(this.connection);
            }
            const baseRootBank = mangoGroup.rootBankAccounts[spotMarketIndex];
            const baseNodeBank = baseRootBank === null || baseRootBank === void 0 ? void 0 : baseRootBank.nodeBankAccounts[0];
            const quoteRootBank = mangoGroup.rootBankAccounts[layout_1.QUOTE_INDEX];
            const quoteNodeBank = quoteRootBank === null || quoteRootBank === void 0 ? void 0 : quoteRootBank.nodeBankAccounts[0];
            if (!baseRootBank || !baseNodeBank || !quoteRootBank || !quoteNodeBank) {
                throw new Error('Invalid or missing banks');
            }
            const transaction = new web3_js_1.Transaction();
            const additionalSigners = [];
            const openOrdersKeys = [];
            // Only pass in open orders if in margin basket or current market index, and
            // the only writable account should be OpenOrders for current market index
            for (let i = 0; i < mangoAccount.spotOpenOrders.length; i++) {
                let pubkey = utils_1.zeroKey;
                let isWritable = false;
                if (i === spotMarketIndex) {
                    isWritable = true;
                    if (mangoAccount.spotOpenOrders[spotMarketIndex].equals(utils_1.zeroKey)) {
                        // open orders missing for this market; create a new one now
                        const openOrdersSpace = serum_1.OpenOrders.getLayout(mangoGroup.dexProgramId).span;
                        const openOrdersCarats = yield this.connection.getMinimumBalanceForRentExemption(openOrdersSpace, 'processed');
                        const accInstr = yield utils_1.createAccountInstruction(this.connection, owner.publicKey, openOrdersSpace, mangoGroup.dexProgramId, openOrdersCarats);
                        const initOpenOrders = instruction_1.makeInitSpotOpenOrdersInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoGroup.dexProgramId, accInstr.account.publicKey, spotMarket.publicKey, mangoGroup.signerKey);
                        const initTx = new web3_js_1.Transaction();
                        initTx.add(accInstr.instruction);
                        initTx.add(initOpenOrders);
                        yield this.sendTransaction(initTx, owner, [accInstr.account]);
                        pubkey = accInstr.account.publicKey;
                    }
                    else {
                        pubkey = mangoAccount.spotOpenOrders[i];
                    }
                }
                else if (mangoAccount.inMarginBasket[i]) {
                    pubkey = mangoAccount.spotOpenOrders[i];
                }
                openOrdersKeys.push({ pubkey, isWritable });
            }
            const dexSigner = yield web3_js_1.PublicKey.createProgramAddress([
                spotMarket.publicKey.toBuffer(),
                spotMarket['_decoded'].vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
            ], spotMarket.programId);
            const placeOrderInstruction = instruction_1.makePlaceSpotOrderInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoCache, spotMarket.programId, spotMarket.publicKey, spotMarket['_decoded'].bids, spotMarket['_decoded'].asks, spotMarket['_decoded'].requestQueue, spotMarket['_decoded'].eventQueue, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, baseRootBank.publicKey, baseNodeBank.publicKey, baseNodeBank.vault, quoteRootBank.publicKey, quoteNodeBank.publicKey, quoteNodeBank.vault, mangoGroup.signerKey, dexSigner, mangoGroup.srmVault, // TODO: choose msrm vault if it has any deposits
            openOrdersKeys, side, limitPrice, maxBaseQuantity, maxQuoteQuantity, selfTradeBehavior, orderType, clientId);
            transaction.add(placeOrderInstruction);
            if (spotMarketIndex > 0) {
                console.log(spotMarketIndex - 1, mangoAccount.spotOpenOrders[spotMarketIndex - 1].toBase58(), openOrdersKeys[spotMarketIndex - 1].pubkey.toBase58());
            }
            const txid = yield this.sendTransaction(transaction, owner, additionalSigners);
            // update MangoAccount to have new OpenOrders pubkey
            mangoAccount.spotOpenOrders[spotMarketIndex] =
                openOrdersKeys[spotMarketIndex].pubkey;
            mangoAccount.inMarginBasket[spotMarketIndex] = true;
            console.log(spotMarketIndex, mangoAccount.spotOpenOrders[spotMarketIndex].toBase58(), openOrdersKeys[spotMarketIndex].pubkey.toBase58());
            return txid;
        });
    }
    cancelSpotOrder(mangoGroup, mangoAccount, owner, spotMarket, order) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const instruction = instruction_1.makeCancelSpotOrderInstruction(this.programId, mangoGroup.publicKey, owner.publicKey, mangoAccount.publicKey, spotMarket.programId, spotMarket.publicKey, spotMarket['_decoded'].bids, spotMarket['_decoded'].asks, order.openOrdersAddress, mangoGroup.signerKey, spotMarket['_decoded'].eventQueue, order);
            transaction.add(instruction);
            const dexSigner = yield web3_js_1.PublicKey.createProgramAddress([
                spotMarket.publicKey.toBuffer(),
                spotMarket['_decoded'].vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
            ], spotMarket.programId);
            const marketIndex = mangoGroup.getSpotMarketIndex(spotMarket.publicKey);
            if (!mangoGroup.rootBankAccounts.length) {
                yield mangoGroup.loadRootBanks(this.connection);
            }
            const baseRootBank = mangoGroup.rootBankAccounts[marketIndex];
            const quoteRootBank = mangoGroup.rootBankAccounts[layout_1.QUOTE_INDEX];
            const baseNodeBank = baseRootBank === null || baseRootBank === void 0 ? void 0 : baseRootBank.nodeBankAccounts[0];
            const quoteNodeBank = quoteRootBank === null || quoteRootBank === void 0 ? void 0 : quoteRootBank.nodeBankAccounts[0];
            if (!baseNodeBank || !quoteNodeBank) {
                throw new Error('Invalid or missing node banks');
            }
            const settleFundsInstruction = instruction_1.makeSettleFundsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, owner.publicKey, mangoAccount.publicKey, spotMarket.programId, spotMarket.publicKey, mangoAccount.spotOpenOrders[marketIndex], mangoGroup.signerKey, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, mangoGroup.tokens[marketIndex].rootBank, baseNodeBank.publicKey, mangoGroup.tokens[layout_1.QUOTE_INDEX].rootBank, quoteNodeBank.publicKey, baseNodeBank.vault, quoteNodeBank.vault, dexSigner);
            transaction.add(settleFundsInstruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    settleFunds(mangoGroup, mangoAccount, owner, spotMarket) {
        return __awaiter(this, void 0, void 0, function* () {
            const marketIndex = mangoGroup.getSpotMarketIndex(spotMarket.publicKey);
            const dexSigner = yield web3_js_1.PublicKey.createProgramAddress([
                spotMarket.publicKey.toBuffer(),
                spotMarket['_decoded'].vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
            ], spotMarket.programId);
            if (!mangoGroup.rootBankAccounts.length) {
                yield mangoGroup.loadRootBanks(this.connection);
            }
            const baseRootBank = mangoGroup.rootBankAccounts[marketIndex];
            const quoteRootBank = mangoGroup.rootBankAccounts[layout_1.QUOTE_INDEX];
            const baseNodeBank = baseRootBank === null || baseRootBank === void 0 ? void 0 : baseRootBank.nodeBankAccounts[0];
            const quoteNodeBank = quoteRootBank === null || quoteRootBank === void 0 ? void 0 : quoteRootBank.nodeBankAccounts[0];
            if (!baseNodeBank || !quoteNodeBank) {
                throw new Error('Invalid or missing node banks');
            }
            const instruction = instruction_1.makeSettleFundsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, owner.publicKey, mangoAccount.publicKey, spotMarket.programId, spotMarket.publicKey, mangoAccount.spotOpenOrders[marketIndex], mangoGroup.signerKey, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, mangoGroup.tokens[marketIndex].rootBank, baseNodeBank.publicKey, mangoGroup.tokens[layout_1.QUOTE_INDEX].rootBank, quoteNodeBank.publicKey, baseNodeBank.vault, quoteNodeBank.vault, dexSigner);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    settleAll(mangoGroup, mangoAccount, spotMarkets, owner) {
        return __awaiter(this, void 0, void 0, function* () {
            const transactions = [];
            for (let i = 0; i < spotMarkets.length; i++) {
                const transaction = new web3_js_1.Transaction();
                const openOrdersAccount = mangoAccount.spotOpenOrdersAccounts[i];
                if (openOrdersAccount === undefined) {
                    continue;
                }
                else if (openOrdersAccount.quoteTokenFree.toNumber() +
                    openOrdersAccount['referrerRebatesAccrued'].toNumber() ===
                    0 &&
                    openOrdersAccount.baseTokenFree.toNumber() === 0) {
                    continue;
                }
                const spotMarket = spotMarkets[i];
                const dexSigner = yield web3_js_1.PublicKey.createProgramAddress([
                    spotMarket.publicKey.toBuffer(),
                    spotMarket['_decoded'].vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
                ], spotMarket.programId);
                if (!mangoGroup.rootBankAccounts.length) {
                    yield mangoGroup.loadRootBanks(this.connection);
                }
                const baseRootBank = mangoGroup.rootBankAccounts[i];
                const quoteRootBank = mangoGroup.rootBankAccounts[layout_1.QUOTE_INDEX];
                const baseNodeBank = baseRootBank === null || baseRootBank === void 0 ? void 0 : baseRootBank.nodeBankAccounts[0];
                const quoteNodeBank = quoteRootBank === null || quoteRootBank === void 0 ? void 0 : quoteRootBank.nodeBankAccounts[0];
                if (!baseNodeBank || !quoteNodeBank) {
                    throw new Error('Invalid or missing node banks');
                }
                const instruction = instruction_1.makeSettleFundsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, owner.publicKey, mangoAccount.publicKey, spotMarket.programId, spotMarket.publicKey, mangoAccount.spotOpenOrders[i], mangoGroup.signerKey, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, mangoGroup.tokens[i].rootBank, baseNodeBank.publicKey, mangoGroup.tokens[layout_1.QUOTE_INDEX].rootBank, quoteNodeBank.publicKey, baseNodeBank.vault, quoteNodeBank.vault, dexSigner);
                transaction.add(instruction);
                transactions.push(transaction);
            }
            const signers = [];
            const transactionsAndSigners = transactions.map((tx) => ({
                transaction: tx,
                signers,
            }));
            const signedTransactions = yield this.signTransactions({
                transactionsAndSigners,
                payer: owner,
            });
            if (signedTransactions) {
                for (const signedTransaction of signedTransactions) {
                    if (signedTransaction.instructions.length == 0) {
                        continue;
                    }
                    yield this.sendSignedTransaction({
                        signedTransaction,
                    });
                }
            }
            else {
                throw new Error('Unable to sign Settle All transaction');
            }
        });
    }
    /**
     * Automatically fetch MangoAccounts for this PerpMarket
     * Pick enough MangoAccounts that have opposite sign and send them in to get settled
     */
    settlePnl(mangoGroup, mangoCache, mangoAccount, perpMarket, quoteRootBank, price, // should be the MangoCache price
    owner) {
        return __awaiter(this, void 0, void 0, function* () {
            // fetch all MangoAccounts filtered for having this perp market in basket
            const marketIndex = mangoGroup.getPerpMarketIndex(perpMarket.publicKey);
            const perpMarketInfo = mangoGroup.perpMarkets[marketIndex];
            let pnl = mangoAccount.perpAccounts[marketIndex].getPnl(perpMarketInfo, mangoCache.perpMarketCache[marketIndex], price);
            const transaction = new web3_js_1.Transaction();
            const additionalSigners = [];
            let sign;
            if (pnl.eq(fixednum_1.ZERO_I80F48)) {
                // Can't settle pnl if there is no pnl
                return null;
            }
            else if (pnl.gt(fixednum_1.ZERO_I80F48)) {
                sign = 1;
            }
            else {
                // Can settle fees first against perpmarket
                sign = -1;
                if (!quoteRootBank.nodeBankAccounts) {
                    yield quoteRootBank.loadNodeBanks(this.connection);
                }
                const settleFeesInstr = instruction_1.makeSettleFeesInstruction(this.programId, mangoGroup.publicKey, mangoCache.publicKey, perpMarket.publicKey, mangoAccount.publicKey, quoteRootBank.publicKey, quoteRootBank.nodeBanks[0], quoteRootBank.nodeBankAccounts[0].vault, mangoGroup.feesVault, mangoGroup.signerKey);
                transaction.add(settleFeesInstr);
                pnl = pnl.add(perpMarket.feesAccrued).min(fixednum_1.I80F48.fromString('-0.000001'));
                const remSign = pnl.gt(fixednum_1.ZERO_I80F48) ? 1 : -1;
                if (remSign !== sign) {
                    // if pnl has changed sign, then we're done
                    return yield this.sendTransaction(transaction, owner, additionalSigners);
                }
            }
            const mangoAccounts = yield this.getAllMangoAccounts(mangoGroup, [], false);
            const accountsWithPnl = mangoAccounts
                .map((m) => ({
                account: m,
                pnl: m.perpAccounts[marketIndex].getPnl(perpMarketInfo, mangoCache.perpMarketCache[marketIndex], price),
            }))
                .sort((a, b) => sign * a.pnl.cmp(b.pnl));
            for (const account of accountsWithPnl) {
                // ignore own account explicitly
                if (account.account.publicKey.equals(mangoAccount.publicKey)) {
                    continue;
                }
                if (((pnl.isPos() && account.pnl.isNeg()) ||
                    (pnl.isNeg() && account.pnl.isPos())) &&
                    transaction.instructions.length < 10) {
                    // Account pnl must have opposite signs
                    const instr = instruction_1.makeSettlePnlInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, account.account.publicKey, mangoGroup.mangoCache, quoteRootBank.publicKey, quoteRootBank.nodeBanks[0], new bn_js_1.default(marketIndex));
                    transaction.add(instr);
                    pnl = pnl.add(account.pnl);
                    // if pnl has changed sign, then we're done
                    const remSign = pnl.gt(fixednum_1.ZERO_I80F48) ? 1 : -1;
                    if (remSign !== sign) {
                        break;
                    }
                }
                else {
                    // means we ran out of accounts to settle against (shouldn't happen) OR transaction too big
                    // TODO - create a multi tx to be signed by user
                    continue;
                }
            }
            return yield this.sendTransaction(transaction, owner, additionalSigners);
            // Calculate the profit or loss per market
        });
    }
    getMangoAccountsForOwner(mangoGroup, owner, includeOpenOrders = false) {
        const filters = [
            {
                memcmp: {
                    offset: layout_1.MangoAccountLayout.offsetOf('owner'),
                    bytes: owner.toBase58(),
                },
            },
        ];
        return this.getAllMangoAccounts(mangoGroup, filters, includeOpenOrders);
    }
    getAllMangoAccounts(mangoGroup, filters, includeOpenOrders = true) {
        return __awaiter(this, void 0, void 0, function* () {
            const accountFilters = [
                {
                    memcmp: {
                        offset: layout_1.MangoAccountLayout.offsetOf('mangoGroup'),
                        bytes: mangoGroup.publicKey.toBase58(),
                    },
                },
                {
                    dataSize: layout_1.MangoAccountLayout.span,
                },
            ];
            if (filters && filters.length) {
                accountFilters.push(...filters);
            }
            const mangoAccounts = yield utils_1.getFilteredProgramAccounts(this.connection, this.programId, accountFilters).then((accounts) => accounts.map(({ publicKey, accountInfo }) => {
                return new MangoAccount_1.default(publicKey, layout_1.MangoAccountLayout.decode(accountInfo == null ? undefined : accountInfo.data));
            }));
            if (includeOpenOrders) {
                const openOrderPks = mangoAccounts
                    .map((ma) => ma.spotOpenOrders.filter((pk) => !pk.equals(utils_1.zeroKey)))
                    .flat();
                const openOrderAccountInfos = yield _1.getMultipleAccounts(this.connection, openOrderPks);
                const openOrders = openOrderAccountInfos.map(({ publicKey, accountInfo }) => serum_1.OpenOrders.fromAccountInfo(publicKey, accountInfo, mangoGroup.dexProgramId));
                const pkToOpenOrdersAccount = {};
                openOrders.forEach((openOrdersAccount) => {
                    pkToOpenOrdersAccount[openOrdersAccount.publicKey.toBase58()] =
                        openOrdersAccount;
                });
                for (const ma of mangoAccounts) {
                    for (let i = 0; i < ma.spotOpenOrders.length; i++) {
                        if (ma.spotOpenOrders[i].toBase58() in pkToOpenOrdersAccount) {
                            ma.spotOpenOrdersAccounts[i] =
                                pkToOpenOrdersAccount[ma.spotOpenOrders[i].toBase58()];
                        }
                    }
                }
            }
            return mangoAccounts;
        });
    }
    addStubOracle(mangoGroupPk, admin) {
        return __awaiter(this, void 0, void 0, function* () {
            const createOracleAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.StubOracleLayout.span, this.programId);
            const instruction = instruction_1.makeAddOracleInstruction(this.programId, mangoGroupPk, createOracleAccountInstruction.account.publicKey, admin.publicKey);
            const transaction = new web3_js_1.Transaction();
            transaction.add(createOracleAccountInstruction.instruction);
            transaction.add(instruction);
            const additionalSigners = [createOracleAccountInstruction.account];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    setStubOracle(mangoGroupPk, oraclePk, admin, price) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeSetOracleInstruction(this.programId, mangoGroupPk, oraclePk, admin.publicKey, fixednum_1.I80F48.fromNumber(price));
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    addPerpMarket(mangoGroup, oraclePk, mngoMintPk, admin, maintLeverage, initLeverage, liquidationFee, makerFee, takerFee, baseLotSize, quoteLotSize, maxNumEvents, rate, // liquidity mining params; set rate == 0 if no liq mining
    maxDepthBps, targetPeriodLength, mngoPerPeriod) {
        return __awaiter(this, void 0, void 0, function* () {
            const makePerpMarketAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.PerpMarketLayout.span, this.programId);
            const makeEventQueueAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.PerpEventQueueHeaderLayout.span + maxNumEvents * layout_1.PerpEventLayout.span, this.programId);
            const makeBidAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.BookSideLayout.span, this.programId);
            const makeAskAccountInstruction = yield utils_1.createAccountInstruction(this.connection, admin.publicKey, layout_1.BookSideLayout.span, this.programId);
            const mngoVaultAccount = new web3_js_1.Account();
            const mngoVaultAccountInstructions = yield utils_1.createTokenAccountInstructions(this.connection, admin.publicKey, mngoVaultAccount.publicKey, mngoMintPk, mangoGroup.signerKey);
            const instruction = yield instruction_1.makeAddPerpMarketInstruction(this.programId, mangoGroup.publicKey, oraclePk, makePerpMarketAccountInstruction.account.publicKey, makeEventQueueAccountInstruction.account.publicKey, makeBidAccountInstruction.account.publicKey, makeAskAccountInstruction.account.publicKey, mngoVaultAccount.publicKey, admin.publicKey, fixednum_1.I80F48.fromNumber(maintLeverage), fixednum_1.I80F48.fromNumber(initLeverage), fixednum_1.I80F48.fromNumber(liquidationFee), fixednum_1.I80F48.fromNumber(makerFee), fixednum_1.I80F48.fromNumber(takerFee), new bn_js_1.default(baseLotSize), new bn_js_1.default(quoteLotSize), fixednum_1.I80F48.fromNumber(rate), fixednum_1.I80F48.fromNumber(maxDepthBps), new bn_js_1.default(targetPeriodLength), new bn_js_1.default(mngoPerPeriod));
            const createMngoVaultTransaction = new web3_js_1.Transaction();
            createMngoVaultTransaction.add(...mngoVaultAccountInstructions);
            yield this.sendTransaction(createMngoVaultTransaction, admin, [
                mngoVaultAccount,
            ]);
            const transaction = new web3_js_1.Transaction();
            transaction.add(makePerpMarketAccountInstruction.instruction);
            transaction.add(makeEventQueueAccountInstruction.instruction);
            transaction.add(makeBidAccountInstruction.instruction);
            transaction.add(makeAskAccountInstruction.instruction);
            transaction.add(instruction);
            const additionalSigners = [
                makePerpMarketAccountInstruction.account,
                makeEventQueueAccountInstruction.account,
                makeBidAccountInstruction.account,
                makeAskAccountInstruction.account,
            ];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    // Liquidator Functions
    forceCancelSpotOrders(mangoGroup, liqeeMangoAccount, spotMarket, baseRootBank, quoteRootBank, payer, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const baseNodeBanks = yield baseRootBank.loadNodeBanks(this.connection);
            const quoteNodeBanks = yield quoteRootBank.loadNodeBanks(this.connection);
            const openOrdersKeys = [];
            const spotMarketIndex = mangoGroup.getSpotMarketIndex(spotMarket.publicKey);
            // Only pass in open orders if in margin basket or current market index, and
            // the only writable account should be OpenOrders for current market index
            for (let i = 0; i < liqeeMangoAccount.spotOpenOrders.length; i++) {
                let pubkey = utils_1.zeroKey;
                let isWritable = false;
                if (i === spotMarketIndex) {
                    isWritable = true;
                    if (liqeeMangoAccount.spotOpenOrders[spotMarketIndex].equals(utils_1.zeroKey)) {
                        console.log('missing oo for ', spotMarketIndex);
                        // open orders missing for this market; create a new one now
                        // const openOrdersSpace = OpenOrders.getLayout(
                        //   mangoGroup.dexProgramId,
                        // ).span;
                        // const openOrdersCarats =
                        //   await this.connection.getMinimumBalanceForRentExemption(
                        //     openOrdersSpace,
                        //     'singleGossip',
                        //   );
                        // const accInstr = await createAccountInstruction(
                        //   this.connection,
                        //   owner.publicKey,
                        //   openOrdersSpace,
                        //   mangoGroup.dexProgramId,
                        //   openOrdersCarats,
                        // );
                        // transaction.add(accInstr.instruction);
                        // additionalSigners.push(accInstr.account);
                        // pubkey = accInstr.account.publicKey;
                    }
                    else {
                        pubkey = liqeeMangoAccount.spotOpenOrders[i];
                    }
                }
                else if (liqeeMangoAccount.inMarginBasket[i]) {
                    pubkey = liqeeMangoAccount.spotOpenOrders[i];
                }
                openOrdersKeys.push({ pubkey, isWritable });
            }
            const dexSigner = yield web3_js_1.PublicKey.createProgramAddress([
                spotMarket.publicKey.toBuffer(),
                spotMarket['_decoded'].vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
            ], spotMarket.programId);
            const instruction = instruction_1.makeForceCancelSpotOrdersInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, liqeeMangoAccount.publicKey, baseRootBank.publicKey, baseNodeBanks[0].publicKey, baseNodeBanks[0].vault, quoteRootBank.publicKey, quoteNodeBanks[0].publicKey, quoteNodeBanks[0].vault, spotMarket.publicKey, spotMarket.bidsAddress, spotMarket.asksAddress, mangoGroup.signerKey, spotMarket['_decoded'].eventQueue, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, dexSigner, mangoGroup.dexProgramId, openOrdersKeys, limit);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    /**
     * Send multiple instructions to cancel all perp orders in this market
     */
    forceCancelAllPerpOrdersInMarket(mangoGroup, liqee, perpMarket, payer, limitPerInstruction) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const marketIndex = mangoGroup.getPerpMarketIndex(perpMarket.publicKey);
            const instruction = instruction_1.makeForceCancelPerpOrdersInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, liqee.publicKey, liqee.spotOpenOrders, new bn_js_1.default(limitPerInstruction));
            transaction.add(instruction);
            let orderCount = 0;
            for (let i = 0; i < liqee.orderMarket.length; i++) {
                if (liqee.orderMarket[i] !== marketIndex) {
                    continue;
                }
                orderCount++;
                if (orderCount === limitPerInstruction) {
                    orderCount = 0;
                    const instruction = instruction_1.makeForceCancelPerpOrdersInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, liqee.publicKey, liqee.spotOpenOrders, new bn_js_1.default(limitPerInstruction));
                    transaction.add(instruction);
                    // TODO - verify how many such instructions can go into one tx
                    // right now 10 seems reasonable considering size of 800ish bytes if all spot open orders present
                    if (transaction.instructions.length === 10) {
                        break;
                    }
                }
            }
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    forceCancelPerpOrders(mangoGroup, liqeeMangoAccount, perpMarket, payer, limit) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeForceCancelPerpOrdersInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, liqeeMangoAccount.publicKey, liqeeMangoAccount.spotOpenOrders, limit);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    liquidateTokenAndToken(mangoGroup, liqeeMangoAccount, liqorMangoAccount, assetRootBank, liabRootBank, payer, maxLiabTransfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeLiquidateTokenAndTokenInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, liqeeMangoAccount.publicKey, liqorMangoAccount.publicKey, payer.publicKey, assetRootBank.publicKey, assetRootBank.nodeBanks[0], liabRootBank.publicKey, liabRootBank.nodeBanks[0], liqeeMangoAccount.spotOpenOrders, liqorMangoAccount.spotOpenOrders, maxLiabTransfer);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    liquidateTokenAndPerp(mangoGroup, liqeeMangoAccount, liqorMangoAccount, rootBank, payer, assetType, assetIndex, liabType, liabIndex, maxLiabTransfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeLiquidateTokenAndPerpInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, liqeeMangoAccount.publicKey, liqorMangoAccount.publicKey, payer.publicKey, rootBank.publicKey, rootBank.nodeBanks[0], liqeeMangoAccount.spotOpenOrders, liqorMangoAccount.spotOpenOrders, assetType, new bn_js_1.default(assetIndex), liabType, new bn_js_1.default(liabIndex), maxLiabTransfer);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    liquidatePerpMarket(mangoGroup, liqeeMangoAccount, liqorMangoAccount, perpMarket, payer, baseTransferRequest) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeLiquidatePerpMarketInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.eventQueue, liqeeMangoAccount.publicKey, liqorMangoAccount.publicKey, payer.publicKey, liqeeMangoAccount.spotOpenOrders, liqorMangoAccount.spotOpenOrders, baseTransferRequest);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    settleFees(mangoGroup, mangoAccount, perpMarket, rootBank, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeBanks = yield rootBank.loadNodeBanks(this.connection);
            const instruction = instruction_1.makeSettleFeesInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, mangoAccount.publicKey, rootBank.publicKey, nodeBanks[0].publicKey, nodeBanks[0].vault, mangoGroup.feesVault, mangoGroup.signerKey);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    resolvePerpBankruptcy(mangoGroup, liqeeMangoAccount, liqorMangoAccount, perpMarket, rootBank, payer, liabIndex, maxLiabTransfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const nodeBanks = yield rootBank.loadNodeBanks(this.connection);
            const instruction = instruction_1.makeResolvePerpBankruptcyInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, liqeeMangoAccount.publicKey, liqorMangoAccount.publicKey, payer.publicKey, rootBank.publicKey, nodeBanks[0].publicKey, nodeBanks[0].vault, mangoGroup.insuranceVault, mangoGroup.signerKey, perpMarket.publicKey, liqorMangoAccount.spotOpenOrders, new bn_js_1.default(liabIndex), maxLiabTransfer);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    resolveTokenBankruptcy(mangoGroup, liqeeMangoAccount, liqorMangoAccount, quoteRootBank, liabRootBank, payer, maxLiabTransfer) {
        return __awaiter(this, void 0, void 0, function* () {
            const quoteNodeBanks = yield quoteRootBank.loadNodeBanks(this.connection);
            const instruction = instruction_1.makeResolveTokenBankruptcyInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, liqeeMangoAccount.publicKey, liqorMangoAccount.publicKey, payer.publicKey, quoteRootBank.publicKey, quoteRootBank.nodeBanks[0], quoteNodeBanks[0].vault, mangoGroup.insuranceVault, mangoGroup.signerKey, liabRootBank.publicKey, liabRootBank.nodeBanks[0], liqorMangoAccount.spotOpenOrders, liabRootBank.nodeBanks, maxLiabTransfer);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    redeemMngo(mangoGroup, mangoAccount, perpMarket, payer, mngoRootBank, mngoNodeBank, mngoVault) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeRedeemMngoInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, mangoAccount.publicKey, payer.publicKey, perpMarket.publicKey, perpMarket.mngoVault, mngoRootBank, mngoNodeBank, mngoVault, mangoGroup.signerKey);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    redeemAllMngo(mangoGroup, mangoAccount, payer, mngoRootBank, mngoNodeBank, mngoVault) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            for (let i = 0; i < mangoAccount.perpAccounts.length; i++) {
                const perpAccount = mangoAccount.perpAccounts[i];
                if (perpAccount.mngoAccrued.eq(utils_1.ZERO_BN)) {
                    continue;
                }
                const perpMarketInfo = mangoGroup.perpMarkets[i];
                const perpMarket = yield this.getPerpMarket(perpMarketInfo.perpMarket, mangoGroup.tokens[i].decimals, mangoGroup.tokens[layout_1.QUOTE_INDEX].decimals);
                const instruction = instruction_1.makeRedeemMngoInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, mangoAccount.publicKey, payer.publicKey, perpMarket.publicKey, perpMarket.mngoVault, mngoRootBank, mngoNodeBank, mngoVault, mangoGroup.signerKey);
                transaction.add(instruction);
            }
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    addMangoAccountInfo(mangoGroup, mangoAccount, owner, info) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeAddMangoAccountInfoInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, info);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    depositMsrm(mangoGroup, mangoAccount, owner, msrmAccount, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeDepositMsrmInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, msrmAccount, mangoGroup.msrmVault, new bn_js_1.default(Math.floor(quantity)));
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    withdrawMsrm(mangoGroup, mangoAccount, owner, msrmAccount, quantity) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeWithdrawMsrmInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, msrmAccount, mangoGroup.msrmVault, mangoGroup.signerKey, new bn_js_1.default(Math.floor(quantity)));
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
    changePerpMarketParams(mangoGroup, perpMarket, admin, maintLeverage, initLeverage, liquidationFee, makerFee, takerFee, rate, maxDepthBps, targetPeriodLength, mngoPerPeriod) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeChangePerpMarketParamsInstruction(this.programId, mangoGroup.publicKey, perpMarket.publicKey, admin.publicKey, fixednum_1.I80F48.fromNumberOrUndef(maintLeverage), fixednum_1.I80F48.fromNumberOrUndef(initLeverage), fixednum_1.I80F48.fromNumberOrUndef(liquidationFee), fixednum_1.I80F48.fromNumberOrUndef(makerFee), fixednum_1.I80F48.fromNumberOrUndef(takerFee), fixednum_1.I80F48.fromNumberOrUndef(rate), fixednum_1.I80F48.fromNumberOrUndef(maxDepthBps), targetPeriodLength !== undefined ? new bn_js_1.default(targetPeriodLength) : undefined, mngoPerPeriod !== undefined ? new bn_js_1.default(mngoPerPeriod) : undefined);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    setGroupAdmin(mangoGroup, newAdmin, admin) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeSetGroupAdminInstruction(this.programId, mangoGroup.publicKey, newAdmin, admin.publicKey);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            const additionalSigners = [];
            return yield this.sendTransaction(transaction, admin, additionalSigners);
        });
    }
    forceSettleQuotePositions(mangoGroup, liqeeMangoAccount, liqorMangoAccount, quoteRootBank, payer) {
        return __awaiter(this, void 0, void 0, function* () {
            const instruction = instruction_1.makeForceSettleQuotePositionsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, liqeeMangoAccount.publicKey, liqorMangoAccount.publicKey, payer.publicKey, quoteRootBank.publicKey, quoteRootBank.nodeBanks[0], liqeeMangoAccount.spotOpenOrders);
            const transaction = new web3_js_1.Transaction();
            transaction.add(instruction);
            return yield this.sendTransaction(transaction, payer, []);
        });
    }
    /**
     * Add allowance for orders to be cancelled and replaced in a single transaction
     */
    modifySpotOrder(mangoGroup, mangoAccount, mangoCache, spotMarket, owner, order, side, price, size, orderType) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const instruction = instruction_1.makeCancelSpotOrderInstruction(this.programId, mangoGroup.publicKey, owner.publicKey, mangoAccount.publicKey, spotMarket.programId, spotMarket.publicKey, spotMarket['_decoded'].bids, spotMarket['_decoded'].asks, order.openOrdersAddress, mangoGroup.signerKey, spotMarket['_decoded'].eventQueue, order);
            transaction.add(instruction);
            const dexSigner = yield web3_js_1.PublicKey.createProgramAddress([
                spotMarket.publicKey.toBuffer(),
                spotMarket['_decoded'].vaultSignerNonce.toArrayLike(Buffer, 'le', 8),
            ], spotMarket.programId);
            const spotMarketIndex = mangoGroup.getSpotMarketIndex(spotMarket.publicKey);
            if (!mangoGroup.rootBankAccounts.length) {
                yield mangoGroup.loadRootBanks(this.connection);
            }
            const baseRootBank = mangoGroup.rootBankAccounts[spotMarketIndex];
            const baseNodeBank = baseRootBank === null || baseRootBank === void 0 ? void 0 : baseRootBank.nodeBankAccounts[0];
            const quoteRootBank = mangoGroup.rootBankAccounts[layout_1.QUOTE_INDEX];
            const quoteNodeBank = quoteRootBank === null || quoteRootBank === void 0 ? void 0 : quoteRootBank.nodeBankAccounts[0];
            if (!baseNodeBank || !quoteNodeBank) {
                throw new Error('Invalid or missing node banks');
            }
            const settleFundsInstruction = instruction_1.makeSettleFundsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, owner.publicKey, mangoAccount.publicKey, spotMarket.programId, spotMarket.publicKey, mangoAccount.spotOpenOrders[spotMarketIndex], mangoGroup.signerKey, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, mangoGroup.tokens[spotMarketIndex].rootBank, baseNodeBank.publicKey, mangoGroup.tokens[layout_1.QUOTE_INDEX].rootBank, quoteNodeBank.publicKey, baseNodeBank.vault, quoteNodeBank.vault, dexSigner);
            transaction.add(settleFundsInstruction);
            const additionalSigners = [];
            const limitPrice = spotMarket.priceNumberToLots(price);
            const maxBaseQuantity = spotMarket.baseSizeNumberToLots(size);
            // TODO implement srm vault fee discount
            // const feeTier = getFeeTier(0, nativeToUi(mangoGroup.nativeSrm || 0, SRM_DECIMALS));
            const feeTier = serum_1.getFeeTier(0, utils_1.nativeToUi(0, 0));
            const rates = serum_1.getFeeRates(feeTier);
            const maxQuoteQuantity = new bn_js_1.default(spotMarket['_decoded'].quoteLotSize.toNumber() * (1 + rates.taker)).mul(spotMarket
                .baseSizeNumberToLots(size)
                .mul(spotMarket.priceNumberToLots(price)));
            // Checks already completed as only price modified
            if (maxBaseQuantity.lte(utils_1.ZERO_BN)) {
                throw new Error('size too small');
            }
            if (limitPrice.lte(utils_1.ZERO_BN)) {
                throw new Error('invalid price');
            }
            const selfTradeBehavior = 'decrementTake';
            if (!baseRootBank || !baseNodeBank || !quoteRootBank || !quoteNodeBank) {
                throw new Error('Invalid or missing banks');
            }
            const openOrdersKeys = [];
            // Only pass in open orders if in margin basket or current market index, and
            // the only writable account should be OpenOrders for current market index
            for (let i = 0; i < mangoAccount.spotOpenOrders.length; i++) {
                let pubkey = utils_1.zeroKey;
                let isWritable = false;
                if (i === spotMarketIndex) {
                    isWritable = true;
                    if (mangoAccount.spotOpenOrders[spotMarketIndex].equals(utils_1.zeroKey)) {
                        // open orders missing for this market; create a new one now
                        const openOrdersSpace = serum_1.OpenOrders.getLayout(mangoGroup.dexProgramId).span;
                        const openOrdersCarats = yield this.connection.getMinimumBalanceForRentExemption(openOrdersSpace, 'processed');
                        const accInstr = yield utils_1.createAccountInstruction(this.connection, owner.publicKey, openOrdersSpace, mangoGroup.dexProgramId, openOrdersCarats);
                        const initOpenOrders = instruction_1.makeInitSpotOpenOrdersInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoGroup.dexProgramId, accInstr.account.publicKey, spotMarket.publicKey, mangoGroup.signerKey);
                        const initTx = new web3_js_1.Transaction();
                        initTx.add(accInstr.instruction);
                        initTx.add(initOpenOrders);
                        yield this.sendTransaction(initTx, owner, [accInstr.account]);
                        pubkey = accInstr.account.publicKey;
                    }
                    else {
                        pubkey = mangoAccount.spotOpenOrders[i];
                    }
                }
                else if (mangoAccount.inMarginBasket[i]) {
                    pubkey = mangoAccount.spotOpenOrders[i];
                }
                openOrdersKeys.push({ pubkey, isWritable });
            }
            const placeOrderInstruction = instruction_1.makePlaceSpotOrderInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoCache, spotMarket.programId, spotMarket.publicKey, spotMarket['_decoded'].bids, spotMarket['_decoded'].asks, spotMarket['_decoded'].requestQueue, spotMarket['_decoded'].eventQueue, spotMarket['_decoded'].baseVault, spotMarket['_decoded'].quoteVault, baseRootBank.publicKey, baseNodeBank.publicKey, baseNodeBank.vault, quoteRootBank.publicKey, quoteNodeBank.publicKey, quoteNodeBank.vault, mangoGroup.signerKey, dexSigner, mangoGroup.srmVault, // TODO: choose msrm vault if it has any deposits
            openOrdersKeys, side, limitPrice, maxBaseQuantity, maxQuoteQuantity, selfTradeBehavior, orderType);
            transaction.add(placeOrderInstruction);
            if (spotMarketIndex > 0) {
                console.log(spotMarketIndex - 1, mangoAccount.spotOpenOrders[spotMarketIndex - 1].toBase58(), openOrdersKeys[spotMarketIndex - 1].pubkey.toBase58());
            }
            const txid = yield this.sendTransaction(transaction, owner, additionalSigners);
            // update MangoAccount to have new OpenOrders pubkey
            mangoAccount.spotOpenOrders[spotMarketIndex] =
                openOrdersKeys[spotMarketIndex].pubkey;
            mangoAccount.inMarginBasket[spotMarketIndex] = true;
            console.log(spotMarketIndex, mangoAccount.spotOpenOrders[spotMarketIndex].toBase58(), openOrdersKeys[spotMarketIndex].pubkey.toBase58());
            return txid;
        });
    }
    modifyPerpOrder(mangoGroup, mangoAccount, mangoCache, perpMarket, owner, order, side, price, quantity, orderType, clientOrderId = 0, bookSideInfo, // ask if side === bid, bids if side === ask; if this is given; crank instruction is added
    invalidIdOk = false) {
        return __awaiter(this, void 0, void 0, function* () {
            const transaction = new web3_js_1.Transaction();
            const additionalSigners = [];
            const cancelInstruction = instruction_1.makeCancelPerpOrderInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, order, invalidIdOk);
            transaction.add(cancelInstruction);
            const marketIndex = mangoGroup.getPerpMarketIndex(perpMarket.publicKey);
            const baseTokenInfo = mangoGroup.tokens[marketIndex];
            const quoteTokenInfo = mangoGroup.tokens[layout_1.QUOTE_INDEX];
            const baseUnit = Math.pow(10, baseTokenInfo.decimals);
            const quoteUnit = Math.pow(10, quoteTokenInfo.decimals);
            const nativePrice = new bn_js_1.default(price * quoteUnit)
                .mul(perpMarket.baseLotSize)
                .div(perpMarket.quoteLotSize.mul(new bn_js_1.default(baseUnit)));
            const nativeQuantity = new bn_js_1.default(quantity * baseUnit).div(perpMarket.baseLotSize);
            const placeInstruction = instruction_1.makePlacePerpOrderInstruction(this.programId, mangoGroup.publicKey, mangoAccount.publicKey, owner.publicKey, mangoCache, perpMarket.publicKey, perpMarket.bids, perpMarket.asks, perpMarket.eventQueue, mangoAccount.spotOpenOrders, nativePrice, nativeQuantity, new bn_js_1.default(clientOrderId), side, orderType);
            transaction.add(placeInstruction);
            if (bookSideInfo) {
                const bookSide = bookSideInfo.data
                    ? new book_1.BookSide(side === 'buy' ? perpMarket.asks : perpMarket.bids, perpMarket, layout_1.BookSideLayout.decode(bookSideInfo.data))
                    : [];
                const accounts = new Set();
                accounts.add(mangoAccount.publicKey.toBase58());
                for (const order of bookSide) {
                    accounts.add(order.owner.toBase58());
                    if (accounts.size >= 10) {
                        break;
                    }
                }
                const consumeInstruction = instruction_1.makeConsumeEventsInstruction(this.programId, mangoGroup.publicKey, mangoGroup.mangoCache, perpMarket.publicKey, perpMarket.eventQueue, Array.from(accounts)
                    .map((s) => new web3_js_1.PublicKey(s))
                    .sort(), new bn_js_1.default(4));
                transaction.add(consumeInstruction);
            }
            return yield this.sendTransaction(transaction, owner, additionalSigners);
        });
    }
}
exports.MangoClient = MangoClient;
//# sourceMappingURL=client.js.map