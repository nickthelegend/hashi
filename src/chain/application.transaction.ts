import { AlgorandEncoder } from "@algorandfoundation/algo-models";

export class ApplicationCall {
    type: string;
    snd: Uint8Array;
    fee: number;
    fv: number;
    lv: number;
    gen: string;
    gh: Uint8Array;
    apap?: Uint8Array; // Approval program
    apsu?: Uint8Array; // Clear state program
    apgs?: { nbs: number; nui: number }; // Global schema
    apls?: { nbs: number; nui: number }; // Local schema
    apid?: number; // Application id
    apaa?: Uint8Array[]; // Application arguments
    apat?: Uint8Array[]; // Accounts
    apfa?: number[]; // Foreign assets
    apas?: number[]; // Foreign apps
    apbx?: { i: number; n: string }[]; // Boxes
    apan?: number; // #pragma version

    // encode the transaction
    encode(): Uint8Array {
        const encoded: Uint8Array = new AlgorandEncoder().encodeTransaction(this);
        return encoded;
    }
}

export interface IApplicationNoOpTxBuilder {
    addSender(sender: string): IApplicationNoOpTxBuilder;
    addFee(fee: number): IApplicationNoOpTxBuilder;
    addFirstValidRound(firstValid: number): IApplicationNoOpTxBuilder;
    addLastValidRound(lastValid: number): IApplicationNoOpTxBuilder;
    addApprovalProgram(apap: Uint8Array): IApplicationNoOpTxBuilder;
    addClearProgram(apsu: Uint8Array): IApplicationNoOpTxBuilder;
    addGlobalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder;
    addLocalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder;
    addApplicationId(appId: number): IApplicationNoOpTxBuilder;
    addApplicationArgs(args: Uint8Array[]): IApplicationNoOpTxBuilder;
    addAccounts(accounts: string[]): IApplicationNoOpTxBuilder;
    addForeignAssets(assets: number[]): IApplicationNoOpTxBuilder;
    addForeignApps(apps: number[]): IApplicationNoOpTxBuilder;
    addBoxes(boxes: { i: number; n: string }[]): IApplicationNoOpTxBuilder;
    addOnCompleteOption(version: number): IApplicationNoOpTxBuilder;

    get(): ApplicationCall;
}

export class ApplicationTxBuilder implements IApplicationNoOpTxBuilder {
    private tx: ApplicationCall;

    constructor(genesisId: string, genesisHash: string) {
        this.tx = new ApplicationCall();
        this.tx.gh = new Uint8Array(Buffer.from(genesisHash, "base64"));
        this.tx.gen = genesisId;
        this.tx.type = "appl";
        this.tx.fee = 1000;
    }

    addSender(sender: string): IApplicationNoOpTxBuilder {
        this.tx.snd = new AlgorandEncoder().decodeAddress(sender);
        return this;
    }

    addFee(fee: number): IApplicationNoOpTxBuilder {
        this.tx.fee = fee;
        return this;
    }

    addFirstValidRound(firstValid: number): IApplicationNoOpTxBuilder {
        this.tx.fv = firstValid;
        return this;
    }

    addLastValidRound(lastValid: number): IApplicationNoOpTxBuilder {
        this.tx.lv = lastValid;
        return this;
    }

    addApprovalProgram(apap: Uint8Array): IApplicationNoOpTxBuilder {
        this.tx.apap = apap;
        return this;
    }

    addClearProgram(apsu: Uint8Array): IApplicationNoOpTxBuilder {
        this.tx.apsu = apsu;
        return this;
    }

    addGlobalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder {
        this.tx.apgs = { nbs, nui };
        return this;
    }

    addLocalSchema(nbs: number, nui: number): IApplicationNoOpTxBuilder {
        this.tx.apls = { nbs, nui };
        return this;
    }

    addApplicationId(appId: number): IApplicationNoOpTxBuilder {
        this.tx.apid = appId;
        return this;
    }

    addApplicationArgs(args: Uint8Array[]): IApplicationNoOpTxBuilder {
        this.tx.apaa = args;
        return this;
    }

    addAccounts(accounts: string[]): IApplicationNoOpTxBuilder {
        this.tx.apat = accounts.map(account => new AlgorandEncoder().decodeAddress(account));
        return this;
    }

    addForeignAssets(assets: number[]): IApplicationNoOpTxBuilder {
        this.tx.apfa = assets;
        return this;
    }

    addForeignApps(apps: number[]): IApplicationNoOpTxBuilder {
        this.tx.apas = apps;
        return this;
    }

    addBoxes(boxes: { i: number; n: string }[]): IApplicationNoOpTxBuilder {
        this.tx.apbx = boxes;
        return this;
    }

    addOnCompleteOption(version: number): IApplicationNoOpTxBuilder {
        this.tx.apan = version;
        return this;
    }

    get(): ApplicationCall {
        return this.tx;
    }
}
