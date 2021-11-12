import { PublicKey, Transaction } from '@gemachain/web3.js';
export declare type Modify<T, R> = Omit<T, keyof R> & R;
export interface WalletAdapter {
    publicKey: PublicKey;
    autoApprove: boolean;
    connected: boolean;
    signTransaction: (transaction: Transaction) => Promise<Transaction>;
    signAllTransactions: (transaction: Transaction[]) => Promise<Transaction[]>;
    connect: () => any;
    disconnect: () => any;
    on(event: string, fn: () => void): this;
}
//# sourceMappingURL=types.d.ts.map