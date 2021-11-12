import { Connection, PublicKey } from '@gemachain/web3.js';
import BN from 'bn.js';
import { BookSide, FillEvent, MangoAccount, PerpEventQueue } from '.';
import { I80F48 } from './fixednum';
import { Modify } from './types';
export declare type ParsedFillEvent = Modify<FillEvent, {
    price: number;
    quantity: number;
}>;
export default class PerpMarket {
    publicKey: PublicKey;
    baseDecimals: number;
    quoteDecimals: number;
    mangoGroup: PublicKey;
    bids: PublicKey;
    asks: PublicKey;
    eventQueue: PublicKey;
    quoteLotSize: BN;
    baseLotSize: BN;
    longFunding: I80F48;
    shortFunding: I80F48;
    openInterest: BN;
    lastUpdated: BN;
    seqNum: BN;
    feesAccrued: I80F48;
    liquidityMiningInfo: {
        rate: I80F48;
        maxDepthBps: I80F48;
        periodStart: BN;
        targetPeriodLength: BN;
        mngoLeft: BN;
        mngoPerPeriod: BN;
    };
    mngoVault: PublicKey;
    constructor(publicKey: PublicKey, baseDecimals: number, quoteDecimals: number, decoded: any);
    priceLotsToNative(price: BN): I80F48;
    baseLotsToNative(quantity: BN): I80F48;
    priceLotsToNumber(price: BN): number;
    baseLotsToNumber(quantity: BN): number;
    get minOrderSize(): number;
    get tickSize(): number;
    loadEventQueue(connection: Connection): Promise<PerpEventQueue>;
    loadFills(connection: Connection): Promise<ParsedFillEvent[]>;
    parseFillEvent(event: any): any;
    loadBids(connection: Connection): Promise<BookSide>;
    loadAsks(connection: Connection): Promise<BookSide>;
    loadOrdersForAccount(connection: Connection, account: MangoAccount): Promise<import("./book").PerpOrder[]>;
}
//# sourceMappingURL=PerpMarket.d.ts.map