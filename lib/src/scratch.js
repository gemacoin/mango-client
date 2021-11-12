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
function verify(programId, realm, tokenAccount) {
    return __awaiter(this, void 0, void 0, function* () {
        const [address, nonce] = yield web3_js_1.PublicKey.findProgramAddress([
            Buffer.from('token-governance', 'utf-8'),
            realm.toBuffer(),
            tokenAccount.toBuffer(),
        ], programId);
        console.log(address.toBase58());
    });
}
const dao_program_id = new web3_js_1.PublicKey('GqTPL6qRf5aUuqscLh8Rg2HTxPUXfhhAXDptTLhp1t2J');
const realm = new web3_js_1.PublicKey('DPiH3H3c7t47BMxqTxLsuPQpEC6Kne8GA9VXbxpnZxFE');
const tokenAccount = new web3_js_1.PublicKey('4PdEyhrV3gaUj4ffwjKGXBLo42jF2CQCCBoXenwCRWXf');
verify(dao_program_id, realm, tokenAccount);
//# sourceMappingURL=scratch.js.map