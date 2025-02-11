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
        const amount = Number(body.amt)
        return await this.txnService.makePayment(body.from, body.to, amount)
        // return await this.txnService.makePayment('test', 'VYG6BEXIW7YKJW3X5MUMYWZU226IPFIJLBZYQJ3FRWMRNR4IT7Q6TIAFWA', 1)
    }

    @Post("asset")
    async createAsset(@Body() body: { from: string, unit: string, decimals: number, totalTokens: number }): Promise<string> {

        const decimals = Number(body.decimals)
        const totalTokens = Number(body.totalTokens)
        return await this.txnService.asset(body.from, body.unit, decimals, totalTokens)
        // return await this.txnService.asset('test', 'test', 0, 10)
    }

    // // 733168409
    @Post("asset-transfer")
    async transferAsset(@Body() body: { assetId: number, from: string, to: string, amount: number }): Promise<string> {

        const assetId = Number(body.assetId)
        const amount = Number(body.amount)

        return await this.txnService.transferToken(assetId, body.from, body.to, amount)
        // return await this.txnService.transferToken(733186475, 'test', 'C6A7MF2QX27SARKX32PUH2WWTUMFTH3UUBQ4DU4KBNXB4N2DTENO6HVF3M',1)
    }

    @Post("sign-submit")
    async signAndSubmit(@Body() body: { txn: string, key: string }): Promise<string> {
        return await this.txnService.signAndSubmit(body.txn, body.key)
    }

}
