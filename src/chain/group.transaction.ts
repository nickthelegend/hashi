import { AlgorandEncoder } from "@algorandfoundation/algo-models";
import * as algosdk from "algosdk";
import { Encoder } from "./encoder.role";
import nacl from "tweetnacl";
import { msgpackRawEncode } from "algosdk";
import { concatArrays } from "../utils/utils";

const ALGORAND_MAX_TX_GROUP_SIZE = 16;
const TX_GROUP_TAG = new TextEncoder().encode('TG');
const TX_TAG = new TextEncoder().encode('TX');
const ALGORAND_TRANSACTION_LENGTH = 32;

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

    rawTxID(txn: any): Uint8Array {
        
        const enMsg = txn.encode();
        const gh = concatArrays(TX_TAG, enMsg);
        return Uint8Array.from(nacl.hash(gh));
      }     

    txGroupPreimage(txnHashes: Uint8Array[]): Uint8Array {
        if (txnHashes.length > ALGORAND_MAX_TX_GROUP_SIZE) {
          throw new Error(
            `${txnHashes.length} transactions grouped together but max group size is ${ALGORAND_MAX_TX_GROUP_SIZE}`
          );
        }
        if (txnHashes.length === 0) {
          throw new Error('Cannot compute group ID of zero transactions');
        }
        const bytes = algosdk.msgpackRawEncode({
          txlist: txnHashes,
        });
        return concatArrays(TX_GROUP_TAG, bytes);
      }

    computeGroupID(txns: any[]): Uint8Array {
        const hashes: Uint8Array[] = [];
        for (const txn of txns) {
          hashes.push(this.rawTxID(txn));
        }
      
        const toBeHashed = this.txGroupPreimage(hashes);
        const gid = nacl.hash(toBeHashed);
        return Uint8Array.from(gid);
      }

    assignGroupID(txns: any[]) {
        const gid = this.computeGroupID(txns);
        for (const txn of txns) {
          txn.group = gid;
        }
        return txns;
      }

    // Encode all transactions
    encodeAll(): Uint8Array[] {
        try {
            // Make sure we have a group ID
            if (!this.groupId && this.transactions.length > 0) {
                // Compute the group ID if not already set
                this.groupId = this.computeGroupID(this.transactions);
                
                // Assign the group ID to all transactions
                for (let i = 0; i < this.transactions.length; i++) {
                    // For transactions that have an addGroup method (like from algo-models)
                    if (typeof this.transactions[i].addGroup === 'function') {
                        console.log(`Using addGroup method for transaction ${i+1}`);
                        this.transactions[i].addGroup(this.groupId);
                    } 
                    // For transactions that have a direct grp property
                    else {
                        console.log(`Setting grp property directly for transaction ${i+1}`);
                        this.transactions[i].grp = this.groupId;
                    }
                    
                    // Remove any 'group' field if it exists as it's not a valid Algorand transaction field
                    if (this.transactions[i].group !== undefined) {
                        delete this.transactions[i].group;
                    }
                }
            }
            
            if (this.groupId) {
                console.log(`Encoding ${this.transactions.length} transactions with group ID: ${Buffer.from(this.groupId).toString('base64')}`);
            } else {
                console.log(`Encoding ${this.transactions.length} transactions without group ID`);
            }
            
            const encodedTxns = [];
            
            for (let i = 0; i < this.transactions.length; i++) {
                const tx = this.transactions[i];
                try {
                    // Log the transaction before encoding
                    console.log(`Transaction ${i+1} before encoding:`);
                    console.log(`Transaction ${i+1} type:`, tx.type);
                    console.log(`Transaction ${i+1} fee:`, tx.fee ? tx.fee.toString() : 'undefined');
                    console.log(`Transaction ${i+1} group ID:`, tx.grp ? Buffer.from(tx.grp).toString('base64') : 'undefined');
                    
                    // Check if the transaction has all required properties
                    if (!tx.type) {
                        console.error(`Transaction ${i+1} is missing required 'type' property`);
                    }
                    
                    if (typeof tx.encode === 'function') {
                        // For our custom transaction types from algo-models
                        console.log(`Encoding transaction ${i+1} with encode() method`);
                        try {
                            const encoded = tx.encode();
                            console.log(`Successfully encoded transaction ${i+1}`);
                            encodedTxns.push(encoded);
                        } catch (encodeSpecificError) {
                            console.error(`Error in encode() method for transaction ${i+1}:`, encodeSpecificError);
                            throw encodeSpecificError;
                        }
                    } else {
                        console.error(`Transaction ${i+1} does not have encode method. Properties:`, Object.keys(tx));
                        throw new Error(`Transaction ${i+1} does not have an encode method`);
                    }
                } catch (encodeError) {
                    console.error(`Error encoding transaction ${i+1}:`, encodeError);
                    
                    // Try to continue with the remaining transactions instead of failing completely
                    if (i === this.transactions.length - 1) {
                        // If this is the last transaction and we have at least one encoded transaction,
                        // we can return what we have
                        if (encodedTxns.length > 0) {
                            console.warn(`Returning ${encodedTxns.length} encoded transactions despite errors`);
                            break;
                        } else {
                            throw new Error(`Failed to encode any transactions: ${encodeError.message}`);
                        }
                    }
                    
                    // Skip this transaction and continue with the next one
                    console.warn(`Skipping transaction ${i+1} due to encoding error`);
                    continue;
                }
            }
            
            console.log('Encoded transactions:', encodedTxns);
            
            return encodedTxns;
        } catch (error) {
            console.error('Error encoding transactions:', error);
            throw new Error(`Failed to encode transactions: ${error.message}`);
        }
    }

    // Encode the transaction for submission
    encode(): Uint8Array[] {
        try {
            if (this.transactions.length === 0) {
                throw new Error("No transactions to encode");
            }
            
            // If we have more than one transaction, assign group IDs
            if (this.transactions.length > 1) {
                // Use our new assignGroupID method to set the group ID
                this.assignGroupID(this.transactions);
                this.groupId = this.transactions[0].group; // Store the group ID
            }
            
            // Encode all transactions
            return this.encodeAll();
        } catch (error) {
            console.error('Error encoding group transaction:', error);
            throw new Error(`Failed to encode group transaction: ${error.message}`);
        }
    }

    // Get the transactions with group ID assigned
    getTransactions(): any[] {
        return this.transactions;
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
        // Clear existing transactions to avoid mixing different groups
        this.tx.transactions = [];
        
        // Add each transaction to the group
        for (const tx of transactions) {
            this.tx.addTransaction(tx);
        }
        
        return this;
    }

    get(): GroupTransaction {
        return this.tx;
    }
}
