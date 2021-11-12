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
Object.defineProperty(exports, "__esModule", { value: true });
const web3_js_1 = require("@gemachain/web3.js");
const client_1 = require("./client");
const config_1 = require("./config");
const config = config_1.Config.ids();
const cluster = (process.env.CLUSTER || 'mainnet');
const connection = new web3_js_1.Connection(config.cluster_urls[cluster], 'processed');
const groupName = process.env.GROUP || 'mainnet.1';
const groupIds = config.getGroup(cluster, groupName);
if (!groupIds) {
    throw new Error(`Group ${groupName} not found`);
}
const mangoProgramId = groupIds.mangoProgramId;
const mangoGroupKey = groupIds.publicKey;
const client = new client_1.MangoClient(connection, mangoProgramId);
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('getMangoGroup');
        const mangoGroup = yield client.getMangoGroup(mangoGroupKey);
        console.log('getAllMangoAccounts');
        const mangoAccounts = yield client.getAllMangoAccounts(mangoGroup);
        console.log('loadCache');
        const cache = yield mangoGroup.loadCache(connection);
        mangoAccounts.sort((a, b) => {
            const aLiabs = a.getLiabsVal(mangoGroup, cache, 'Maint');
            const bLiabs = b.getLiabsVal(mangoGroup, cache, 'Maint');
            return bLiabs.sub(aLiabs).toNumber();
        });
        for (let i = 0; i < Math.min(30, mangoAccounts.length); i++) {
            console.log(i);
            console.log(mangoAccounts[i].toPrettyString(groupIds, mangoGroup, cache));
        }
    });
}
main();
//# sourceMappingURL=positions.js.map