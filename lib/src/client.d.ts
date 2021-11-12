/// <reference types="node" />
import { Account, AccountInfo, Connection, PublicKey, Transaction, TransactionConfirmationStatus, TransactionSignature } from '@gemachain/web3.js';
import BN from 'bn.js';
import { AssetType, MangoCache } from './layout';
import MangoAccount from './MangoAccount';
import PerpMarket from './PerpMarket';
import RootBank from './RootBank';
import { Market } from '@project-serum/serum';
import { I80F48 } from './fixednum';
import { Order } from '@project-serum/serum/lib/market';
import { WalletAdapter } from './types';
import { PerpOrder } from './book';
import MangoGroup from './MangoGroup';
export declare const getUnixTs: () => number;
export declare class MangoClient {
    connection: Connection;
    programId: PublicKey;
    constructor(connection: Connection, programId: PublicKey);
    sendTransactions(transactions: Transaction[], payer: Account | WalletAdapter, additionalSigners: Account[], timeout?: number, confirmLevel?: TransactionConfirmationStatus): Promise<TransactionSignature[]>;
    signTransaction({ transaction, payer, signers }: {
        transaction: any;
        payer: any;
        signers: any;
    }): Promise<any>;
    signTransactions({ transactionsAndSigners, payer, }: {
        transactionsAndSigners: {
            transaction: Transaction;
            signers?: Array<Account>;
        }[];
        payer: Account | WalletAdapter;
    }): Promise<Transaction[] | undefined>;
    sendTransaction(transaction: Transaction, payer: Account | WalletAdapter, additionalSigners: Account[], timeout?: number, confirmLevel?: TransactionConfirmationStatus, postSignTxCallback?: any): Promise<TransactionSignature>;
    sendSignedTransaction({ signedTransaction, timeout, confirmLevel, }: {
        signedTransaction: Transaction;
        timeout?: number;
        confirmLevel?: TransactionConfirmationStatus;
    }): Promise<string>;
    initMangoGroup(quoteMint: PublicKey, msrmMint: PublicKey, dexProgram: PublicKey, feesVault: PublicKey, // owned by Mango DAO token governance
    validInterval: number, quoteOptimalUtil: number, quoteOptimalRate: number, quoteMaxRate: number, payer: Account | WalletAdapter): Promise<PublicKey>;
    getMangoGroup(mangoGroup: PublicKey): Promise<MangoGroup>;
    initMangoAccount(mangoGroup: MangoGroup, owner: Account | WalletAdapter): Promise<PublicKey>;
    getMangoAccount(mangoAccountPk: PublicKey, dexProgramId: PublicKey): Promise<MangoAccount>;
    initMangoAccountAndDeposit(mangoGroup: MangoGroup, owner: Account | WalletAdapter, rootBank: PublicKey, nodeBank: PublicKey, vault: PublicKey, tokenAcc: PublicKey, quantity: number, info?: string): Promise<string>;
    deposit(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, rootBank: PublicKey, nodeBank: PublicKey, vault: PublicKey, tokenAcc: PublicKey, quantity: number): Promise<TransactionSignature>;
    withdraw(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, rootBank: PublicKey, nodeBank: PublicKey, vault: PublicKey, quantity: number, allowBorrow: boolean): Promise<TransactionSignature>;
    cacheRootBanks(mangoGroup: PublicKey, mangoCache: PublicKey, rootBanks: PublicKey[], payer: Account | WalletAdapter): Promise<TransactionSignature>;
    cachePrices(mangoGroup: PublicKey, mangoCache: PublicKey, oracles: PublicKey[], payer: Account | WalletAdapter): Promise<TransactionSignature>;
    cachePerpMarkets(mangoGroup: PublicKey, mangoCache: PublicKey, perpMarkets: PublicKey[], payer: Account): Promise<TransactionSignature>;
    updateRootBank(mangoGroup: MangoGroup, rootBank: PublicKey, nodeBanks: PublicKey[], payer: Account | WalletAdapter): Promise<TransactionSignature>;
    consumeEvents(mangoGroup: MangoGroup, perpMarket: PerpMarket, mangoAccounts: PublicKey[], payer: Account, limit: BN): Promise<TransactionSignature>;
    updateFunding(mangoGroup: PublicKey, mangoCache: PublicKey, perpMarket: PublicKey, bids: PublicKey, asks: PublicKey, payer: Account): Promise<TransactionSignature>;
    getPerpMarket(perpMarketPk: PublicKey, baseDecimal: number, quoteDecimal: number): Promise<PerpMarket>;
    placePerpOrder(mangoGroup: MangoGroup, mangoAccount: MangoAccount, mangoCache: PublicKey, perpMarket: PerpMarket, owner: Account | WalletAdapter, side: 'buy' | 'sell', price: number, quantity: number, orderType?: 'limit' | 'ioc' | 'postOnly', clientOrderId?: number, bookSideInfo?: AccountInfo<Buffer>): Promise<TransactionSignature>;
    cancelPerpOrder(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, perpMarket: PerpMarket, order: PerpOrder, invalidIdOk?: boolean): Promise<TransactionSignature>;
    addOracle(mangoGroup: MangoGroup, oracle: PublicKey, admin: Account): Promise<TransactionSignature>;
    setOracle(mangoGroup: MangoGroup, oracle: PublicKey, admin: Account, price: I80F48): Promise<TransactionSignature>;
    addSpotMarket(mangoGroup: MangoGroup, oracle: PublicKey, spotMarket: PublicKey, mint: PublicKey, admin: Account, maintLeverage: number, initLeverage: number, liquidationFee: number, optimalUtil: number, optimalRate: number, maxRate: number): Promise<TransactionSignature>;
    /**
     * Make sure mangoAccount has recent and valid inMarginBasket and spotOpenOrders
     */
    placeSpotOrder(mangoGroup: MangoGroup, mangoAccount: MangoAccount, mangoCache: PublicKey, spotMarket: Market, owner: Account | WalletAdapter, side: 'buy' | 'sell', price: number, size: number, orderType?: 'limit' | 'ioc' | 'postOnly', clientId?: BN): Promise<TransactionSignature>;
    cancelSpotOrder(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, spotMarket: Market, order: Order): Promise<TransactionSignature>;
    settleFunds(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, spotMarket: Market): Promise<TransactionSignature>;
    settleAll(mangoGroup: MangoGroup, mangoAccount: MangoAccount, spotMarkets: Market[], owner: Account | WalletAdapter): Promise<void>;
    /**
     * Automatically fetch MangoAccounts for this PerpMarket
     * Pick enough MangoAccounts that have opposite sign and send them in to get settled
     */
    settlePnl(mangoGroup: MangoGroup, mangoCache: MangoCache, mangoAccount: MangoAccount, perpMarket: PerpMarket, quoteRootBank: RootBank, price: I80F48, // should be the MangoCache price
    owner: Account | WalletAdapter): Promise<TransactionSignature | null>;
    getMangoAccountsForOwner(mangoGroup: MangoGroup, owner: PublicKey, includeOpenOrders?: boolean): Promise<MangoAccount[]>;
    getAllMangoAccounts(mangoGroup: MangoGroup, filters?: any[], includeOpenOrders?: boolean): Promise<MangoAccount[]>;
    addStubOracle(mangoGroupPk: PublicKey, admin: Account): Promise<string>;
    setStubOracle(mangoGroupPk: PublicKey, oraclePk: PublicKey, admin: Account, price: number): Promise<string>;
    addPerpMarket(mangoGroup: MangoGroup, oraclePk: PublicKey, mngoMintPk: PublicKey, admin: Account, maintLeverage: number, initLeverage: number, liquidationFee: number, makerFee: number, takerFee: number, baseLotSize: number, quoteLotSize: number, maxNumEvents: number, rate: number, // liquidity mining params; set rate == 0 if no liq mining
    maxDepthBps: number, targetPeriodLength: number, mngoPerPeriod: number): Promise<string>;
    forceCancelSpotOrders(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, spotMarket: Market, baseRootBank: RootBank, quoteRootBank: RootBank, payer: Account, limit: BN): Promise<string>;
    /**
     * Send multiple instructions to cancel all perp orders in this market
     */
    forceCancelAllPerpOrdersInMarket(mangoGroup: MangoGroup, liqee: MangoAccount, perpMarket: PerpMarket, payer: Account | WalletAdapter, limitPerInstruction: number): Promise<TransactionSignature>;
    forceCancelPerpOrders(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, perpMarket: PerpMarket, payer: Account, limit: BN): Promise<string>;
    liquidateTokenAndToken(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, liqorMangoAccount: MangoAccount, assetRootBank: RootBank, liabRootBank: RootBank, payer: Account, maxLiabTransfer: I80F48): Promise<string>;
    liquidateTokenAndPerp(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, liqorMangoAccount: MangoAccount, rootBank: RootBank, payer: Account, assetType: AssetType, assetIndex: number, liabType: AssetType, liabIndex: number, maxLiabTransfer: I80F48): Promise<string>;
    liquidatePerpMarket(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, liqorMangoAccount: MangoAccount, perpMarket: PerpMarket, payer: Account, baseTransferRequest: BN): Promise<string>;
    settleFees(mangoGroup: MangoGroup, mangoAccount: MangoAccount, perpMarket: PerpMarket, rootBank: RootBank, payer: Account): Promise<string>;
    resolvePerpBankruptcy(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, liqorMangoAccount: MangoAccount, perpMarket: PerpMarket, rootBank: RootBank, payer: Account, liabIndex: number, maxLiabTransfer: I80F48): Promise<string>;
    resolveTokenBankruptcy(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, liqorMangoAccount: MangoAccount, quoteRootBank: RootBank, liabRootBank: RootBank, payer: Account, maxLiabTransfer: I80F48): Promise<string>;
    redeemMngo(mangoGroup: MangoGroup, mangoAccount: MangoAccount, perpMarket: PerpMarket, payer: Account | WalletAdapter, mngoRootBank: PublicKey, mngoNodeBank: PublicKey, mngoVault: PublicKey): Promise<TransactionSignature>;
    redeemAllMngo(mangoGroup: MangoGroup, mangoAccount: MangoAccount, payer: Account | WalletAdapter, mngoRootBank: PublicKey, mngoNodeBank: PublicKey, mngoVault: PublicKey): Promise<TransactionSignature>;
    addMangoAccountInfo(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, info: string): Promise<TransactionSignature>;
    depositMsrm(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, msrmAccount: PublicKey, quantity: number): Promise<TransactionSignature>;
    withdrawMsrm(mangoGroup: MangoGroup, mangoAccount: MangoAccount, owner: Account | WalletAdapter, msrmAccount: PublicKey, quantity: number): Promise<TransactionSignature>;
    changePerpMarketParams(mangoGroup: MangoGroup, perpMarket: PerpMarket, admin: Account | WalletAdapter, maintLeverage: number | undefined, initLeverage: number | undefined, liquidationFee: number | undefined, makerFee: number | undefined, takerFee: number | undefined, rate: number | undefined, maxDepthBps: number | undefined, targetPeriodLength: number | undefined, mngoPerPeriod: number | undefined): Promise<TransactionSignature>;
    setGroupAdmin(mangoGroup: MangoGroup, newAdmin: PublicKey, admin: Account | WalletAdapter): Promise<TransactionSignature>;
    forceSettleQuotePositions(mangoGroup: MangoGroup, liqeeMangoAccount: MangoAccount, liqorMangoAccount: MangoAccount, quoteRootBank: RootBank, payer: Account): Promise<string>;
    /**
     * Add allowance for orders to be cancelled and replaced in a single transaction
     */
    modifySpotOrder(mangoGroup: MangoGroup, mangoAccount: MangoAccount, mangoCache: PublicKey, spotMarket: Market, owner: Account | WalletAdapter, order: Order, side: 'buy' | 'sell', price: number, size: number, orderType?: 'limit' | 'ioc' | 'postOnly'): Promise<TransactionSignature>;
    modifyPerpOrder(mangoGroup: MangoGroup, mangoAccount: MangoAccount, mangoCache: PublicKey, perpMarket: PerpMarket, owner: Account | WalletAdapter, order: PerpOrder, side: 'buy' | 'sell', price: number, quantity: number, orderType?: 'limit' | 'ioc' | 'postOnly', clientOrderId?: number, bookSideInfo?: AccountInfo<Buffer>, // ask if side === bid, bids if side === ask; if this is given; crank instruction is added
    invalidIdOk?: boolean): Promise<TransactionSignature>;
}
//# sourceMappingURL=client.d.ts.map