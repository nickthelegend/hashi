import { Body, Controller, Get, Logger, Param, Post } from "@nestjs/common"
import { WalletService } from "../wallet/wallet.service"
import { EncoderFactory } from "../chain/encoder.factory"
import { Crafter } from "../chain/crafter.role"
import { ConfigService } from "@nestjs/config"
import { CrafterFactory } from "../chain/crafter.factory"
import { ApiTags } from "@nestjs/swagger"
import { TransactionService } from "./transaction.service"


@ApiTags("Transaction")
@Controller()
export class Transaction {
    constructor(private readonly walletService: WalletService, private readonly configService: ConfigService, private readonly txnService: TransactionService) {}


    @Post("payment")
    async makePayment(@Body() body: { from: string, to: string, amt: number }): Promise<string> {
        // return this.txnService.makePayment(body.from, body.to, body.amt)
        return await this.txnService.makePayment('test', 'VYG6BEXIW7YKJW3X5MUMYWZU226IPFIJLBZYQJ3FRWMRNR4IT7Q6TIAFWA', 1)
    }

    @Post("asset")
    async createAsset(@Body() body: { from: string, unit: string, decimals: bigint, totalTokens: number }): Promise<string> {
        // return this.txnService.createAsset(body.from, body.unit, body.decimals, body.totalTokens)
        return await this.txnService.createAsset('test', 'tst', BigInt(0), 10)
    }
}
