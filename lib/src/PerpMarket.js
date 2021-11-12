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
const big_js_1 = __importDefault(require("big.js"));
const bn_js_1 = __importDefault(require("bn.js"));
const _1 = require(".");
const fixednum_1 = require("./fixednum");
const utils_1 = require("./utils");
class PerpMarket {
    constructor(publicKey, baseDecimals, quoteDecimals, decoded) {
        this.publicKey = publicKey;
        this.baseDecimals = baseDecimals;
        this.quoteDecimals = quoteDecimals;
        Object.assign(this, decoded);
    }
    priceLotsToNative(price) {
        return fixednum_1.I80F48.fromI64(this.quoteLotSize.mul(price)).div(fixednum_1.I80F48.fromI64(this.baseLotSize));
    }
    baseLotsToNative(quantity) {
        return fixednum_1.I80F48.fromI64(this.baseLotSize.mul(quantity));
    }
    priceLotsToNumber(price) {
        const nativeToUi = new big_js_1.default(10).pow(this.baseDecimals - this.quoteDecimals);
        const lotsToNative = new big_js_1.default(this.quoteLotSize.toString()).div(new big_js_1.default(this.baseLotSize.toString()));
        return new big_js_1.default(price.toString())
            .mul(lotsToNative)
            .mul(nativeToUi)
            .toNumber();
    }
    baseLotsToNumber(quantity) {
        return new big_js_1.default(quantity.toString())
            .mul(new big_js_1.default(this.baseLotSize.toString()))
            .div(new big_js_1.default(10).pow(this.baseDecimals))
            .toNumber();
    }
    get minOrderSize() {
        return this.baseLotsToNumber(new bn_js_1.default(1));
    }
    get tickSize() {
        return this.priceLotsToNumber(new bn_js_1.default(1));
    }
    loadEventQueue(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const acc = yield connection.getAccountInfo(this.eventQueue);
            const parsed = _1.PerpEventQueueLayout.decode(acc === null || acc === void 0 ? void 0 : acc.data);
            return new _1.PerpEventQueue(parsed);
        });
    }
    loadFills(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const q = yield this.loadEventQueue(connection);
            // TODO - verify this works
            return q
                .eventsSince(utils_1.ZERO_BN)
                .map((e) => e.fill)
                .filter((e) => !!e)
                .map(this.parseFillEvent.bind(this));
        });
    }
    parseFillEvent(event) {
        const quantity = this.baseLotsToNumber(event.quantity);
        const price = this.priceLotsToNumber(event.price);
        return Object.assign(Object.assign({}, event), { quantity,
            price });
    }
    loadBids(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const acc = yield connection.getAccountInfo(this.bids);
            const book = new _1.BookSide(this.bids, this, _1.BookSideLayout.decode(acc === null || acc === void 0 ? void 0 : acc.data));
            return book;
        });
    }
    loadAsks(connection) {
        return __awaiter(this, void 0, void 0, function* () {
            const acc = yield connection.getAccountInfo(this.asks);
            const book = new _1.BookSide(this.asks, this, _1.BookSideLayout.decode(acc === null || acc === void 0 ? void 0 : acc.data));
            return book;
        });
    }
    loadOrdersForAccount(connection, account) {
        return __awaiter(this, void 0, void 0, function* () {
            const [bids, asks] = yield Promise.all([
                this.loadBids(connection),
                this.loadAsks(connection),
            ]);
            // @ts-ignore
            return [...bids, ...asks].filter((order) => (order.owner).equals(account.publicKey));
        });
    }
}
exports.default = PerpMarket;
//# sourceMappingURL=PerpMarket.js.map