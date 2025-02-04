import { ConfigService } from "@nestjs/config"
import { Crafter } from "./crafter.role"
import { AlgorandTransactionCrafter } from '@algorandfoundation/algo-models'
import { AssetCreateTxBuilder, IAssetCreateTxBuilder } from "./asset.create"

import { AssetTransfer, AssetTransferTxBuilder, IAssetTransferTxBuilder } from "./asset.transfer"

export class AlgoTxCrafter extends AlgorandTransactionCrafter {
	constructor(genesisIdCrafter: string, genesisHashCrafter: string, private readonly configService: ConfigService) {
		super(genesisIdCrafter, genesisHashCrafter)
	}

	assetTransfer(assetId: number, from: string, to: string, amount: number | bigint): IAssetTransferTxBuilder {
		return new AssetTransferTxBuilder(super['genesisId'], super['genesisHash'], assetId, from, to, amount)
			.addFee(1000)
	}

	asset(from: string, unit: string, decimals: bigint, totalTokens: number, firstRound:number, lastRound:number): IAssetCreateTxBuilder {
		
		return new AssetCreateTxBuilder(super['genesisId'], super['genesisHash'], decimals, totalTokens, false)
			.addSender(from)
			.addFee(1000)
			.addFirstValidRound(firstRound)
			.addLastValidRound(lastRound)
			.addUnit(unit)
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
