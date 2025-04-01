import { AlgorandEncoder } from "@algorandfoundation/algo-models";
import * as algosdk from "algosdk";
import { Encoder } from "./encoder.role";

export class GroupTransaction {
    transactions: any[];
    groupId: Uint8Array;
    snd: Uint8Array;
    fee: bigint;
    fv: bigint;
    lv: bigint;
    gen: string;
    gh: Uint8Array;

    constructor() {
        this.transactions = [];
    }

    // Add a transaction to the group
    addTransaction(transaction: any): void {
        this.transactions.push(transaction);
    }

    // Compute the group ID
    computeGroupID(): void {
        if (this.transactions.length === 0) {
            throw new Error("No transactions in group");
        }

        // Convert transactions to algosdk format if needed
        const txns = this.transactions.map(tx => {
            if (tx.encode) {
                // If it's our custom transaction type with encode method
                const encodedTx = tx.encode();
                return new AlgorandEncoder().encodeTransaction(encodedTx)
            }
            return tx; // Already in algosdk format
        });

        // Compute group ID
        this.groupId = algosdk.computeGroupID(txns);

        // Assign group ID to each transaction
        for (let i = 0; i < this.transactions.length; i++) {
            if (this.transactions[i].grp !== undefined) {
                this.transactions[i].grp = this.groupId;
            } else if (this.transactions[i].group !== undefined) {
                this.transactions[i].group = this.groupId;
            }
        }
    }

    // Get the transactions with group ID assigned
    getTransactions(): any[] {
        return this.transactions;
    }

    // Encode all transactions
    encodeAll(): Uint8Array[] {
        return this.transactions.map(tx => {
            if (tx.encode) {
                return tx.encode();
            }
            // If neither encode nor toByte is available, throw an error
            throw new Error("Transaction does not have an encode method");
        });
    }
}

export interface IGroupTransactionBuilder {
    addSender(sender: string): IGroupTransactionBuilder;
    addFee(fee: bigint): IGroupTransactionBuilder;
    addFirstValidRound(firstValid: bigint): IGroupTransactionBuilder;
    addLastValidRound(lastValid: bigint): IGroupTransactionBuilder;
    addTransactions(transactions: any[]): IGroupTransactionBuilder;
    get(): GroupTransaction;
}

export class GroupTransactionBuilder implements IGroupTransactionBuilder {
    private tx: GroupTransaction;

    constructor(genesisId: string, genesisHash: string) {
        this.tx = new GroupTransaction();
        this.tx.gh = new Uint8Array(Buffer.from(genesisHash, "base64"));
        this.tx.gen = genesisId;
        this.tx.fee = BigInt(1000);
    }

    addSender(sender: string): IGroupTransactionBuilder {
        this.tx.snd = new AlgorandEncoder().decodeAddress(sender);
        return this;
    }

    addFee(fee: bigint): IGroupTransactionBuilder {
        this.tx.fee = fee;
        return this;
    }

    addFirstValidRound(firstValid: bigint): IGroupTransactionBuilder {
        this.tx.fv = firstValid;
        return this;
    }

    addLastValidRound(lastValid: bigint): IGroupTransactionBuilder {
        this.tx.lv = lastValid;
        return this;
    }

    addTransactions(transactions: any[]): IGroupTransactionBuilder {
        transactions.forEach(tx => {
            this.tx.addTransaction(tx);
        });
        this.tx.computeGroupID();
        return this;
    }

    get(): GroupTransaction {
        return this.tx;
    }
}
