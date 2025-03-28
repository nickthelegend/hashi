import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { VaultService } from "../vault/vault.service"
import { HttpService } from "@nestjs/axios"
import { ConfigService } from "@nestjs/config"
import { AlgorandEncoder, AlgorandTransactionCrafter, AssetParamsBuilder } from '@algorandfoundation/algo-models'
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
     * 
     * @param from 
     * @param to 
     * @param amt 
     * @returns 
     */
    async makePayment(from:string, to:string, amt:number): Promise<{ txnId: string, error: string}> {
        
        if (!from || !to || amt === undefined || amt === null) {
            throw new Error('Invalid payment parameters');
        }

        try {
            
            const publicKey: Buffer = await this.walletService.getPublicKey(from)
            const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

            const suggestedParams = await this.getSuggestedParams();
        
            const encoded = this.txnCrafter.pay(amt, fromAddr, to)
                                            .addFirstValidRound(Number(suggestedParams.firstValid))
                                            .addLastValidRound(Number(suggestedParams.lastValid))
                                            .get().encode();
                                                         

            const txnId = await this.signAndSubmitTransaction(encoded, from);
            
            return { txnId, error : null }

        } catch (error) {
            throw new Error(error.response.data.message);
        }
    }

    /**
     * 
     * @param from - Hashi vault key name
     * @param unit 
     * @param decimals 
     * @param totalTokens 
     * @param params 
     * @returns 
     */
    async asset(from: string, unit: string, decimals: number, totalTokens: number, params: Assetparams = {}): Promise<{txnId:string, assetId: string, error : string}> {
        if (!from || !unit || totalTokens === undefined || totalTokens === null || decimals === undefined || decimals === null) {
            throw new Error('Invalid asset creation parameters');
        }
 
        try {
            const publicKey: Buffer = await this.walletService.getPublicKey(from)
            const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

            const suggestedParams = await this.getSuggestedParams();

            const crafter = CrafterFactory.getCrafter("algorand", this.configService)

            const assetCreateTxBuilder = crafter.asset(fromAddr, unit, decimals, totalTokens, Number(suggestedParams.firstValid), Number(suggestedParams.lastValid), params.defaultFrozen)

            // Add optional parameters if they exist
            if (params.assetName) {
                assetCreateTxBuilder.addName(params.assetName);
            }
            if (params.url) {
                assetCreateTxBuilder.addUrl(params.url);
            }
            
            if (params.managerAddress) {
                assetCreateTxBuilder.addManagerAddress(params.managerAddress);
            }
            if (params.reserveAddress) {
                assetCreateTxBuilder.addReserveAddress(params.reserveAddress);
            }
            if (params.freezeAddress) {
                assetCreateTxBuilder.addFreezeAddress(params.freezeAddress);
            }
            if (params.clawbackAddress) {
                assetCreateTxBuilder.addClawbackAddress(params.clawbackAddress);
            }
            
            const encoded =  assetCreateTxBuilder.get().encode(); 

            const txnId = await this.signAndSubmitTransaction(encoded, from);

            const algorand = this.algorand("testnet")

            const transaction = await this.waitForTransaction(txnId, 10, 2000, algorand)

            const assetId = transaction.transaction.createdAssetIndex;

            return { assetId: assetId.toString(), txnId, error: null};

        } catch (error) {
            console.error('Asset creation error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error creating asset';
            throw new Error(errorMessage);
        }
       
    }

    /**
     * 
     * @param assetId 
     * @param from - Hashi vault key name
     * @param to 
     * @param amount 
     * @returns 
     */
    async transferToken(assetId: number, from: string, to: string, amount: number): Promise<{ txnId:string, error : string }> {
        if (!from || !to || amount === undefined || amount === null || assetId === undefined || assetId === null) {
            throw new Error('Invalid asset transfer parameters');
        }

        try {            
            const publicKey: Buffer = await this.walletService.getPublicKey(from)
            const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

            const suggestedParams = await this.getSuggestedParams();

            const encoded = this.txnCrafter.transferAsset(fromAddr, assetId,  to, amount)
                                            .addFirstValidRound(Number(suggestedParams.firstValid))
                                            .addLastValidRound(Number(suggestedParams.lastValid))
                                            .get().encode();

            const txnId = await this.signAndSubmitTransaction(encoded, from);

            return { txnId, error: null};

        } catch (error) {
            return { txnId: null, error: error.response.data.message};
        }
    }

    /**
     * 
     * @param assetId 
     * @param from - Hashi vault key name
     * @returns 
     */
    async optInAsset(assetId: number, from: string): Promise<{ txnId:string, error : string }> {
        if (!from || assetId === undefined || assetId === null) {
            throw new Error('Invalid asset opt-in parameters');
        }       

        try {
            
            const publicKey: Buffer = await this.walletService.getPublicKey(from)
            const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

            const suggestedParams = await this.getSuggestedParams();

            const crafter = CrafterFactory.getCrafter("algorand", this.configService)

            const encoded = crafter.assetTransfer(assetId, fromAddr, fromAddr, 0)
                                    .addFirstValidRound(Number(suggestedParams.firstValid))
                                    .addLastValidRound(Number(suggestedParams.lastValid))
                                    .get().encode()

            const txnId = await this.signAndSubmitTransaction(encoded, from)
            
            return  { txnId, error: null};

        } catch (error) {
            console.error('Token transfer error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error transferring token';
            throw new Error(errorMessage);
        }
    }

    async optOutAsset(assetId: number, from: string, close: string): Promise<{ txnId:string, error : string }> {
        if (!from || assetId === undefined || assetId === null) {
            throw new Error('Invalid asset opt-out parameters');
        }       

        try {
            
            const publicKey: Buffer = await this.walletService.getPublicKey(from)
            const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

            const suggestedParams = await this.getSuggestedParams();

            const crafter = CrafterFactory.getCrafter("algorand", this.configService)

            const encoded = crafter.assetTransfer(assetId, fromAddr, fromAddr, 0)
                                    .addFirstValidRound(Number(suggestedParams.firstValid))
                                    .addLastValidRound(Number(suggestedParams.lastValid))
                                    .addClose(close)
                                    .get().encode()

            const txnId = await this.signAndSubmitTransaction(encoded, from)
            
            return  { txnId, error: null};
        } catch (error) {
            console.error('Token transfer error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error transferring token';
            throw new Error(errorMessage);
        }
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

    async signAndSubmitTransaction(encoded: Uint8Array, from: string): Promise<string> {
        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId;
    }

       /**
        * 
        * @param from - Hashi vault key name
        * @param approvalProgram 
        * @param clearProgram 
        * @param globalSchema 
        * @param localSchema 
        * @returns 
        */   

    async createApplication ( 
        from: string, 
        approvalProgram: string, 
        clearProgram: string, 
        appArgs: Array<Uint8Array>,
        globalSchema: { numByteSlice: number, numUint: number }, localSchema: { numByteSlice: number, numUint: number } 
    ): Promise<{ txnId:string, applicationId: number, error : string }> {
        if (!from || !approvalProgram || !clearProgram || !globalSchema || !localSchema) {
            throw new Error('Invalid application creation parameters');
        }

        const crafter = CrafterFactory.getCrafter("algorand", this.configService)

        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

        const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
        const suggestedParams = await algodClient.getTransactionParams().do();this.algorand("testnet")
        try {
            
            const encoded = crafter.createApplication(fromAddr, 
                algosdk.base64ToBytes(approvalProgram), 
                algosdk.base64ToBytes(clearProgram), 
                appArgs,
                globalSchema, 
                localSchema, 
                suggestedParams.firstValid, 
                suggestedParams.lastValid)
                .get().encode();

            //     console.log(encoded);
                

            const txnId = await this.signAndSubmitTransaction(encoded, from) // 'Test';//

            const transaction = await this.waitForTransaction(txnId, 10, 2000, this.algorand("testnet"))     

            return  { txnId, applicationId:transaction.transaction.createdApplicationIndex, error: null};
        } catch (error) {
            console.error('Application creation error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error creating application';
            throw new Error(errorMessage);
        }
    }

    async callApplicationABIMethod(from: string, appIndex: bigint, appArgs: any,  foreignApps: Array<number>, foreignAssets: Array<number>): Promise<{ txnId:string, error : string }> {
        if (!from || appIndex === undefined || appIndex === null) {
            throw new Error('Invalid application call parameters');
        }   

        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);
       try {
            const algodClient = new algosdk.Algodv2("", "https://testnet-api.algonode.cloud", "");
            const suggestedParams = await algodClient.getTransactionParams().do();
            
            const crafter = CrafterFactory.getCrafter("algorand", this.configService)
            
            
            const encoded = crafter.callApplicationMethod(fromAddr, appIndex, appArgs, foreignApps, foreignAssets, suggestedParams.firstValid, suggestedParams.lastValid).get().encode();
            // const encoded = crafter.callApplicationMethod(fromAddr, appIndex, new Uint8Array(appArgs), foreignApps, foreignAssets, suggestedParams.firstValid, suggestedParams.lastValid).get().encode();

            // const encoded = algosdk.makeApplicationNoOpTxnFromObject({
            //     sender: fromAddr,
            //     appIndex: appIndex,
            //     appArgs: appArgs,
            //     accounts: [],
            //     foreignApps: foreignApps,
            //     foreignAssets: foreignAssets,
            //     boxes: [],
            //     suggestedParams: suggestedParams
            // }).toEncodingData();

            // console.log(encoded);
            
            const txnId = await this.signAndSubmitTransaction(encoded, from);

            // const transaction = await this.waitForTransaction(txnId, 10, 2000, this.algorand("testnet"))

            // const result = await algodClient.getApplicationBoxById(appId, method).do();

            return { txnId, error: null};
        } catch (error) {
            console.error('Application method call error:', error);
            // Safely extract error message without assuming response structure
            const errorMessage = error.response?.data?.message || error.message || 'Unknown error calling application method';
            throw new Error(errorMessage);
        }
    }

    async applicationCall(
        from: string, 
        appIndex: number, 
        approvalProgram?: string, 
        clearProgram?: string, 
        globalSchema?: { numByteSlice: number, numUint: number }, 
        localSchema?: { numByteSlice: number, numUint: number }, 
        appArgs?: Array<Uint8Array>, 
        foreignApps?: Array<number>, 
        foreignAssets?: Array<number>,
        accounts?: Array<string>): Promise<{ txnId: string, applicationId: number, error: string }> {  
            try {
                const publicKey: Buffer = await this.walletService.getPublicKey(from)
                const fromAddr = EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

                const suggestedParams = await this.getSuggestedParams();

                const crafter = CrafterFactory.getCrafter("algorand", this.configService)
                
                // Convert parameters to the correct types
                const approvalProgramBytes = approvalProgram ? algosdk.base64ToBytes(approvalProgram) : new Uint8Array(0);
                const clearProgramBytes = clearProgram ? algosdk.base64ToBytes(clearProgram) : new Uint8Array(0);
                
                const applicationBuilder = crafter.applicationCall(
                    fromAddr, 
                    approvalProgramBytes, 
                    clearProgramBytes,
                    appArgs, 
                    globalSchema, 
                    localSchema, 
                    suggestedParams.firstValid, 
                    suggestedParams.lastValid,
                    foreignApps, 
                    foreignAssets,
                    BigInt(appIndex),
                    accounts)

                const encoded = applicationBuilder.get().encode();

                const txnId = await this.signAndSubmitTransaction(encoded, from);

                const transaction = await this.waitForTransaction(txnId, 10, 2000, this.algorand("testnet"))     

                return { txnId, applicationId: transaction.transaction.createdApplicationIndex ?? appIndex, error: null };
            } catch (error) {
                console.error('Error in applicationCall:', error);  
                // Safely extract error message without assuming response structure
                const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
                return { txnId: '', applicationId: appIndex, error: errorMessage };
            }
        
    }

}