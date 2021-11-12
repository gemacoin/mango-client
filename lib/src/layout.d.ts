/// <reference types="node" />
import { Blob, Layout, Structure, UInt } from 'buffer-layout';
import { PublicKey } from '@gemachain/web3.js';
import { I80F48 } from './fixednum';
import BN from 'bn.js';
import PerpAccount from './PerpAccount';
export declare const MAX_TOKENS = 16;
export declare const MAX_PAIRS: number;
export declare const MAX_NODE_BANKS = 8;
export declare const INFO_LEN = 32;
export declare const QUOTE_INDEX: number;
export declare const MAX_NUM_IN_MARGIN_BASKET = 10;
export declare const MAX_PERP_OPEN_ORDERS = 64;
export declare const FREE_ORDER_SLOT = 255;
declare class _I80F48Layout extends Blob {
    constructor(property: string);
    decode(b: any, offset: any): I80F48;
    encode(src: any, b: any, offset: any): any;
}
export declare function I80F48Layout(property?: string): _I80F48Layout;
declare class BNLayout extends Blob {
    signed: boolean;
    constructor(number: number, property: any, signed?: boolean);
    decode(b: any, offset: any): BN;
    encode(src: any, b: any, offset: any): any;
}
export declare function u64(property?: string): BNLayout;
export declare function i64(property?: string): BNLayout;
export declare function u128(property?: string): BNLayout;
export declare function i128(property?: string): BNLayout;
declare class WrappedLayout<T, U> extends Layout<U> {
    layout: Layout<T>;
    decoder: (data: T) => U;
    encoder: (src: U) => T;
    constructor(layout: Layout<T>, decoder: (data: T) => U, encoder: (src: U) => T, property?: string);
    decode(b: Buffer, offset?: number): U;
    encode(src: U, b: Buffer, offset?: number): number;
    getSpan(b: Buffer, offset?: number): number;
}
export declare function bool(property?: string): WrappedLayout<number, boolean>;
declare class EnumLayout extends UInt {
    values: any;
    constructor(values: any, span: any, property?: any);
    encode(src: any, b: any, offset: any): any;
    decode(b: any, offset: any): string;
}
export declare function sideLayout(span: any, property?: any): EnumLayout;
export declare function orderTypeLayout(property: any, span: any): EnumLayout;
export declare function selfTradeBehaviorLayout(property: any): EnumLayout;
/**
 * Need to implement layouts for each of the structs found in state.rs
 */
export declare const MangoInstructionLayout: any;
export declare function encodeMangoInstruction(data: any): Buffer;
export declare class PublicKeyLayout extends Blob {
    constructor(property: any);
    decode(b: any, offset: any): PublicKey;
    encode(src: any, b: any, offset: any): any;
}
export declare function publicKeyLayout(property?: string): PublicKeyLayout;
export declare const DataType: {
    MangoGroup: number;
    MangoAccount: number;
    RootBank: number;
    NodeBank: number;
    PerpMarket: number;
    Bids: number;
    Asks: number;
    MangoCache: number;
    EventQueue: number;
};
export declare const enum AssetType {
    Token = 0,
    Perp = 1
}
export declare class MetaData {
    dataType: number;
    version: number;
    isInitialized: boolean;
    constructor(decoded: any);
}
export declare class MetaDataLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): MetaData;
    encode(src: any, b: any, offset: any): any;
}
export declare function metaDataLayout(property?: string): MetaDataLayout;
export declare class TokenInfo {
    mint: PublicKey;
    rootBank: PublicKey;
    decimals: number;
    padding: number[];
    constructor(decoded: any);
    isEmpty(): boolean;
}
export declare class TokenInfoLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): TokenInfo;
    encode(src: any, b: any, offset: any): any;
}
export declare function tokenInfoLayout(property?: string): TokenInfoLayout;
export declare class SpotMarketInfo {
    spotMarket: PublicKey;
    maintAssetWeight: I80F48;
    initAssetWeight: I80F48;
    maintLiabWeight: I80F48;
    initLiabWeight: I80F48;
    liquidationFee: I80F48;
    constructor(decoded: any);
    isEmpty(): boolean;
}
export declare class SpotMarketInfoLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): SpotMarketInfo;
    encode(src: any, b: any, offset: any): any;
}
export declare function spotMarketInfoLayout(property?: string): SpotMarketInfoLayout;
export declare class PerpMarketInfo {
    perpMarket: PublicKey;
    maintAssetWeight: I80F48;
    initAssetWeight: I80F48;
    maintLiabWeight: I80F48;
    initLiabWeight: I80F48;
    liquidationFee: I80F48;
    makerFee: I80F48;
    takerFee: I80F48;
    baseLotSize: BN;
    quoteLotSize: BN;
    constructor(decoded: any);
    isEmpty(): boolean;
}
export declare class PerpMarketInfoLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): PerpMarketInfo;
    encode(src: any, b: any, offset: any): any;
}
export declare function perpMarketInfoLayout(property?: string): PerpMarketInfoLayout;
export declare class PerpAccountLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): PerpAccount;
    encode(src: any, b: any, offset: any): any;
}
export declare function perpAccountLayout(property?: string): PerpAccountLayout;
export declare const MangoGroupLayout: any;
export declare const MangoAccountLayout: any;
export declare const RootBankLayout: any;
export declare const NodeBankLayout: any;
export declare const StubOracleLayout: any;
export declare class LiquidityMiningInfoLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): MetaData;
    encode(src: any, b: any, offset: any): any;
}
export declare function liquidityMiningInfoLayout(property?: string): LiquidityMiningInfoLayout;
export declare const PerpMarketLayout: any;
export declare const PerpEventLayout: any;
export interface FillEvent {
    takerSide: 'buy' | 'sell';
    makerSlot: number;
    makerOut: boolean;
    timestamp: BN;
    seqNum: BN;
    maker: PublicKey;
    makerOrderId: BN;
    makerClientOrderId: BN;
    makerFee: I80F48;
    bestInitial: BN;
    makerTimestamp: BN;
    taker: PublicKey;
    takerOrderId: BN;
    takerClientOrderId: BN;
    takerFee: I80F48;
    price: BN;
    quantity: BN;
}
export interface OutEvent {
    side: 'buy' | 'sell';
    slot: number;
    timestamp: BN;
    seqNum: BN;
    owner: PublicKey;
    quantity: BN;
}
export interface LiquidateEvent {
    timestamp: BN;
    seqNum: BN;
    liqee: PublicKey;
    liqor: PublicKey;
    price: I80F48;
    quantity: BN;
    liquidationFee: I80F48;
}
export declare const PerpEventQueueHeaderLayout: any;
export declare const PerpEventQueueLayout: any;
export declare const BookSideLayout: any;
export declare class PriceCache {
    price: I80F48;
    lastUpdate: BN;
    constructor(decoded: any);
}
export declare class PriceCacheLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): PriceCache;
    encode(src: any, b: any, offset: any): any;
}
export declare function priceCacheLayout(property?: string): PriceCacheLayout;
export declare class RootBankCache {
    depositIndex: I80F48;
    borrowIndex: I80F48;
    lastUpdate: BN;
    constructor(decoded: any);
}
export declare class RootBankCacheLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): RootBankCache;
    encode(src: any, b: any, offset: any): any;
}
export declare function rootBankCacheLayout(property?: string): RootBankCacheLayout;
export declare class PerpMarketCache {
    longFunding: I80F48;
    shortFunding: I80F48;
    lastUpdate: BN;
    constructor(decoded: any);
}
export declare class PerpMarketCacheLayout extends Structure {
    constructor(property: any);
    decode(b: any, offset: any): PerpMarketCache;
    encode(src: any, b: any, offset: any): any;
}
export declare function perpMarketCacheLayout(property?: string): PerpMarketCacheLayout;
export declare const MangoCacheLayout: any;
export declare class MangoCache {
    publicKey: PublicKey;
    priceCache: PriceCache[];
    rootBankCache: RootBankCache[];
    perpMarketCache: PerpMarketCache[];
    constructor(publicKey: PublicKey, decoded: any);
}
export declare class NodeBank {
    publicKey: PublicKey;
    deposits: I80F48;
    borrows: I80F48;
    vault: PublicKey;
    constructor(publicKey: PublicKey, decoded: any);
}
export declare const TokenAccountLayout: any;
export {};
//# sourceMappingURL=layout.d.ts.map