import { ConfigService } from "@nestjs/config"
import { Crafter } from "./crafter.role"
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models'
import { AssetCreateTxBuilder, IAssetCreateTxBuilder } from "./asset.create"

import { AssetTransfer, AssetTransferTxBuilder, IAssetTransferTxBuilder } from "./asset.transfer"
import { ApplicationTxBuilder } from "./application.transaction"


export class AlgoTxCrafter extends AlgorandTransactionCrafter {
	constructor(private readonly genesisIdCrafter: string, private genesisHashCrafter: string, private readonly configService: ConfigService) {
		super(genesisIdCrafter, genesisHashCrafter)
	}

	assetTransfer(assetId: number, from: string, to: string, amount: number | bigint): IAssetTransferTxBuilder {
		return new AssetTransferTxBuilder(this.genesisIdCrafter, this.genesisHashCrafter, assetId, from, to, amount)
			.addFee(1000)
	}

	asset(from: string, unit: string, decimals: bigint, totalTokens: number, firstRound:number, lastRound:number, defaultFrozen : boolean): IAssetCreateTxBuilder {
		
		const assetBuilder =  new AssetCreateTxBuilder(this.genesisIdCrafter, this.genesisHashCrafter, decimals, totalTokens)
			.addSender(from)
			.addFee(1000)
			.addFirstValidRound(firstRound)
			.addLastValidRound(lastRound)
			.addUnit(unit)
			.addTotalTokens(totalTokens)

			if(decimals){
				assetBuilder.addDecimals(decimals)
			}

			if(defaultFrozen){
				assetBuilder.addDefaultFreeze(defaultFrozen)
			}
		return assetBuilder;	
	}

	createApplication(from: string, approvalProgram: Uint8Array, clearProgram: Uint8Array, globalSchema: { numByteSlice: number, numUint: number }, localSchema: { numByteSlice: number, numUint: number }, firstRound:bigint, lastRound:bigint): any {
		return new ApplicationTxBuilder(this.genesisIdCrafter, this.genesisHashCrafter)
		.addSender(from)
		// .addFee(BigInt(1000))
		.addApprovalProgram(approvalProgram)
		.addClearProgram(clearProgram)
		.addGlobalSchema(globalSchema.numByteSlice, globalSchema.numUint)
		.addLocalSchema(localSchema.numByteSlice, localSchema.numUint)
		.addFirstValidRound(firstRound)
		.addLastValidRound(lastRound)
		// .addApplicationId(BigInt(0))
		.addOnCompleteOption(0)
        // .addApplicationArgs([])  // Empty array as default
        // .addAccounts([])         // Empty array as default
        // .addForeignAssets([])    // Empty array as default
        // .addForeignApps([])      // Empty array as default
        // .addBoxes([])            // Empty array as default
		// .addExtraProgram(0)
		// // .addLease(new Uint8Array())
		// .addRekey(new Uint8Array())
		// .addGroup(new Uint8Array())
		// .addNote(new Uint8Array([]))
	}
}

export class CrafterFactory {
	static getCrafter(chain, configService: ConfigService): any {
		switch (chain) {
			case "algorand":
				const genesisId: string = configService.get<string>("GENESIS_ID")
				const genesisHash: string = configService.get<string>("GENESIS_HASH")
				return new AlgoTxCrafter(genesisId, genesisHash, configService)
			default:
				throw new Error("Chain not supported")
		}
	}
}
