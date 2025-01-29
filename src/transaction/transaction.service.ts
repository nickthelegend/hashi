import { Injectable, Logger, OnModuleInit } from "@nestjs/common"
import { VaultService } from "../vault/vault.service"
import { sha512_256 } from "js-sha512"
import base32 from "hi-base32"
import { HttpService } from "@nestjs/axios"
import { ConfigService } from "@nestjs/config"
import { AxiosResponse } from "axios"
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models'
import { WalletService } from "src/wallet/wallet.service"
import { sign } from "crypto"
import { log } from "console"
import { EncoderFactory } from "../chain/encoder.factory"
import { AlgoTxCrafter, CrafterFactory } from "src/chain/crafter.factory"


@Injectable()
export class TransactionService implements OnModuleInit {
    constructor(private readonly vaultService: VaultService, 
        private readonly httpService: HttpService, 
        private readonly configService: ConfigService, 
        private crafter: AlgoTxCrafter, 
        private txnCrafter: AlgorandTransactionCrafter,
        private readonly walletService: WalletService) {
            this.crafter = CrafterFactory.getCrafter("algorand", this.configService)

            const genesisId: string = configService.get<string>("GENESIS_ID")
			const genesisHash: string = configService.get<string>("GENESIS_HASH")
            this.txnCrafter = new AlgorandTransactionCrafter(genesisId, genesisHash)
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
       
        const encoded = this.txnCrafter.pay(amt, fromAddr, to).addFirstValidRound(48188159).addLastValidRound(48189159).get().encode();

        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId
    }


    
    async createAsset(from: string, unit: string, decimals: bigint, totalTokens: number): Promise<string> {
        if (!from || !unit || totalTokens === undefined || totalTokens === null || decimals === undefined || decimals === null) {
            throw new Error('Invalid asset creation parameters');
        }
        console.log(from, unit, decimals, totalTokens);
        

        const publicKey: Buffer = await this.walletService.getPublicKey(from)
        const fromAddr =  EncoderFactory.getEncoder("algorand").encodeAddress(publicKey);

        const encoded = this.crafter.asset(fromAddr, unit, decimals, totalTokens ).get().encode();

        const sig = await this.sign(encoded, from);

        const ready = await this.txnCrafter.addSignature(encoded, sig)

        const txtId = await this.walletService.submitTransaction(ready)

        return txtId;
    }
    
}