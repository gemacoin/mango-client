import { Account, Connection, PublicKey } from '@gemachain/web3.js';
import { GroupConfig } from '../config';
export default function listMarket(connection: Connection, payer: Account, groupConfig: GroupConfig, baseMint: PublicKey, quoteMint: PublicKey, baseLotSize: number, quoteLotSize: number, dexProgramId: PublicKey): Promise<PublicKey>;
//# sourceMappingURL=listMarket.d.ts.map