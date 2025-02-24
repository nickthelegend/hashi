import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { VaultService } from "../vault/vault.service"
import { HttpService } from "@nestjs/axios"
import { ConfigService } from "@nestjs/config"
import { AlgorandTransactionCrafter, AssetParamsBuilder } from '@algorandfoundation/algo-models'
// import { AssetParams, AssetParamsBuilder } from "src/chain/algorand.asset.params";
import { WalletService } from "src/wallet/wallet.service"
import { EncoderFactory } from "src/chain/encoder.factory"
import { AlgoTxCrafter, CrafterFactory } from "src/chain/crafter.factory"
// import { AssetConfigTxBuilder, IAssetConfigTxBuilder } from "src/chain/algorand.transaction.acfg"
import algosdk from "algosdk"
import { AlgorandClient, Config } from '@algorandfoundation/algokit-utils'

interface Assetparams {
    assetName?: string;
    url?: string;
    defaultFrozen?: boolean;
    managerAddress?: string;
    reserveAddress?: string;
    freezeAddress?: string;
    clawbackAddress?: string;
}


@Injectable()
export class TransactionService implements OnModuleInit {
    constructor(private readonly vaultService: VaultService, 
        private readonly httpService: HttpService, 
        private readonly configService: ConfigService, 
        // private crafter: AlgoTxCrafter, 
        private txnCrafter: AlgorandTransactionCrafter,
        private readonly walletService: WalletService,
        private genesisId :string,
        private genesisHash: string,
        ) {
            // this.crafter = CrafterFactory.getCrafter("algorand", this.configService)

            this.genesisId = configService.get<string>("GENESIS_ID")
			this.genesisHash = configService.get<string>("GENESIS_HASH")
            this.txnCrafter = new AlgorandTransactionCrafter(this.genesisId, this.genesisHash)
        }
    
    /**
	 *
	 */
	async onModuleInit() {
		await this.auth(this.configService.get<string>("VAULT_TOKEN"))
	}

    /**
	 *
	 * @param token
	 * @returns
	 */
	async auth(token: string): Promise<boolean> {
		let isOkay: boolean = false

		try {
			isOkay = await this.vaultService.auth(token)
		} catch (error) {
			Logger.error("Failed to auth to vault", "WalletService.auth")
		}

		return isOkay
	}

    async sign(data: Uint8Array, key: string): Promise<Uint8Array> {
		//TODO: prompt new auth method

		const string: string = (await this.walletService.rawSign(Buffer.from(data), key)).toString()
		// split vault specific prefixes vault:${version}:signature
		const signature = string.split(":")[2]

		// vault default base64 decode
		const decoded: Buffer = Buffer.from(signature, "base64")

		// return as Uint8Array
		return new Uint8Array(decoded)
	}

    /**
     * @param from - Key of the sender
     * 
     */
    async makePayment(from:string, to:string, amt:number): Promise<string> {
        
        if (!from || !to || amt === undefined || amt === null) {
            throw new Error('Invalid payment parameters');
        }

        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

        const suggestedParams = await this.getSuggestedParams();
       
        const encoded = this.txnCrafter.pay(amt, fromAddr, to).addFirstValidRound(Number(suggestedParams.firstValid)).addLastValidRound(Number(suggestedParams.lastValid)).get().encode();

        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId
        
    }

    
    async asset(from: string, unit: string, decimals: number, totalTokens: number, params: Assetparams = {}): Promise<bigint> {
        if (!from || !unit || totalTokens === undefined || totalTokens === null || decimals === undefined || decimals === null) {
            throw new Error('Invalid asset creation parameters');
        }
 
        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

        const suggestedParams = await this.getSuggestedParams();

        const assetParams = new AssetParamsBuilder().addTotal(totalTokens).addUnitName(unit);

        if (decimals) {
            assetParams.addDecimals(decimals)
        }


          // Add optional parameters if they exist
        if (params.assetName) {
            assetParams.addAssetName(params.assetName);
        }
        // if (params.url) {
        //     assetParams (params.assetName);
        // }
        if (params.defaultFrozen !== undefined && params.defaultFrozen === true) {
            assetParams.addDefaultFrozen(params.defaultFrozen);
        }
        if (params.managerAddress) {
            assetParams.addManagerAddress(params.managerAddress);
        }
        if (params.reserveAddress) {
            assetParams.addReserveAddress(params.reserveAddress);
        }
        if (params.freezeAddress) {
            assetParams.addFreezeAddress(params.freezeAddress);
        }
        if (params.clawbackAddress) {
            assetParams.addClawbackAddress(params.clawbackAddress);
        }
        
        const encoded = this.txnCrafter.createAsset(fromAddr, assetParams.get()).addFirstValidRound(Number(suggestedParams.firstValid)).addLastValidRound(Number(suggestedParams.lastValid)).get().encode() 

        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        const algorand = this.algorand("testnet")

        const transaction = await this.waitForTransaction(txtId, 10, 2000, algorand)

        const assetId = transaction.transaction.createdAssetIndex;

        return assetId;
       
    }

    async transferToken(assetId: number, from: string, to: string, amount: number): Promise<string> {
        if (!from || !to || amount === undefined || amount === null || assetId === undefined || assetId === null) {
            throw new Error('Invalid asset transfer parameters');
        }

        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

        const suggestedParams = await this.getSuggestedParams();

        const encoded = this.txnCrafter.transferAsset(fromAddr, assetId,  to, amount).addFirstValidRound(Number(suggestedParams.firstValid)).addLastValidRound(Number(suggestedParams.lastValid)).get().encode();

        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId;
    }

    algorand(net : string): AlgorandClient {
        return AlgorandClient.testNet()
    }

    async getSuggestedParams(): Promise<algosdk.SuggestedParams> {
        const params = await this.algorand("testnet").getSuggestedParams();
        return params;
    }

    async waitForTransaction(txnId, maxRetries = 10, delayMs = 2000, algorand:AlgorandClient): Promise<any> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const transaction = await algorand.client.indexer.lookupTransactionByID(txnId).do();
                return transaction;
            } catch (error) {
                if (i === maxRetries - 1) {
                    throw new Error(`Transaction not found after ${maxRetries} attempts: ${error.message}`);
                }
                console.log(`Attempt ${i + 1}: Transaction not yet indexed, retrying in ${delayMs/1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            }
        }
    }

    async createApplication ( 
        from: string, 
        approvalProgram: string, 
        clearProgram: string, 
        globalSchema: { numByteSlice: number, numUint: number }, localSchema: { numByteSlice: number, numUint: number } 
    ): Promise<string> {
        if (!from || !approvalProgram || !clearProgram || !globalSchema || !localSchema) {
            throw new Error('Invalid application creation parameters');
        }

        const crafter = CrafterFactory.getCrafter("algorand", this.configService)

        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

        const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
        const suggestedParams = await algodClient.getTransactionParams().do();

    //    const approvalProgram1 = algodClient.compile(approvalProgram).do();
        
        const encoded = crafter.createApplication(fromAddr, 
            Buffer.from(approvalProgram, 'base64'), 
            Buffer.from(clearProgram,'base64'), 
            globalSchema, 
            localSchema, 
            Number(suggestedParams.firstValid), 
            Number(suggestedParams.lastValid))
            .get().encode();
        
        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId;
    }
}