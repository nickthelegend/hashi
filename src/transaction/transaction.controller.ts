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

   @Post("create-application")
   async createApplication(@Body() body: { from: string, approvalProgram: string, clearProgram: string, globalSchema: { numByteSlice: number, numUint: number }, localSchema: { numByteSlice: number, numUint: number } }): Promise<string> {
    //    const globalSchema = body.globalSchema
    //    const localSchema = body.localSchema
       
       
    //    return await this.txnService.createApplication(body.from, body.approvalProgram, body.clearProgram, globalSchema, localSchema)
       return await this.txnService.createApplication('test', 
        'I3ByYWdtYSB2ZXJzaW9uIDEwCiNwcmFnbWEgdHlwZXRyYWNrIGZhbHNlCgovLyBhbGdvcHkuYXJjNC5BUkM0Q29udHJhY3QuYXBwcm92YWxfcHJvZ3JhbSgpIC0+IHVpbnQ2NDoKbWFpbjoKICAgIC8vIHNtYXJ0X2NvbnRyYWN0cy9oZWxsb193b3JsZC9jb250cmFjdC5weTo1CiAgICAvLyBjbGFzcyBIZWxsb1dvcmxkKEFSQzRDb250cmFjdCk6CiAgICB0eG4gTnVtQXBwQXJncwogICAgYnogbWFpbl9iYXJlX3JvdXRpbmdANgogICAgcHVzaGJ5dGVzIDB4MDJiZWNlMTEgLy8gbWV0aG9kICJoZWxsbyhzdHJpbmcpc3RyaW5nIgogICAgdHhuYSBBcHBsaWNhdGlvbkFyZ3MgMAogICAgbWF0Y2ggbWFpbl9oZWxsb19yb3V0ZUAzCgptYWluX2FmdGVyX2lmX2Vsc2VAMTA6CiAgICAvLyBzbWFydF9jb250cmFjdHMvaGVsbG9fd29ybGQvY29udHJhY3QucHk6NQogICAgLy8gY2xhc3MgSGVsbG9Xb3JsZChBUkM0Q29udHJhY3QpOgogICAgcHVzaGludCAwIC8vIDAKICAgIHJldHVybgoKbWFpbl9oZWxsb19yb3V0ZUAzOgogICAgLy8gc21hcnRfY29udHJhY3RzL2hlbGxvX3dvcmxkL2NvbnRyYWN0LnB5OjYKICAgIC8vIEBhYmltZXRob2QoKQogICAgdHhuIE9uQ29tcGxldGlvbgogICAgIQogICAgYXNzZXJ0IC8vIE9uQ29tcGxldGlvbiBpcyBub3QgTm9PcAogICAgdHhuIEFwcGxpY2F0aW9uSUQKICAgIGFzc2VydCAvLyBjYW4gb25seSBjYWxsIHdoZW4gbm90IGNyZWF0aW5nCiAgICAvLyBzbWFydF9jb250cmFjdHMvaGVsbG9fd29ybGQvY29udHJhY3QucHk6NQogICAgLy8gY2xhc3MgSGVsbG9Xb3JsZChBUkM0Q29udHJhY3QpOgogICAgdHhuYSBBcHBsaWNhdGlvbkFyZ3MgMQogICAgZXh0cmFjdCAyIDAKICAgIC8vIHNtYXJ0X2NvbnRyYWN0cy9oZWxsb193b3JsZC9jb250cmFjdC5weTo2CiAgICAvLyBAYWJpbWV0aG9kKCkKICAgIGNhbGxzdWIgaGVsbG8KICAgIGR1cAogICAgbGVuCiAgICBpdG9iCiAgICBleHRyYWN0IDYgMgogICAgc3dhcAogICAgY29uY2F0CiAgICBwdXNoYnl0ZXMgMHgxNTFmN2M3NQogICAgc3dhcAogICAgY29uY2F0CiAgICBsb2cKICAgIHB1c2hpbnQgMSAvLyAxCiAgICByZXR1cm4KCm1haW5fYmFyZV9yb3V0aW5nQDY6CiAgICAvLyBzbWFydF9jb250cmFjdHMvaGVsbG9fd29ybGQvY29udHJhY3QucHk6NQogICAgLy8gY2xhc3MgSGVsbG9Xb3JsZChBUkM0Q29udHJhY3QpOgogICAgdHhuIE9uQ29tcGxldGlvbgogICAgYm56IG1haW5fYWZ0ZXJfaWZfZWxzZUAxMAogICAgdHhuIEFwcGxpY2F0aW9uSUQKICAgICEKICAgIGFzc2VydCAvLyBjYW4gb25seSBjYWxsIHdoZW4gY3JlYXRpbmcKICAgIHB1c2hpbnQgMSAvLyAxCiAgICByZXR1cm4KCgovLyBzbWFydF9jb250cmFjdHMuaGVsbG9fd29ybGQuY29udHJhY3QuSGVsbG9Xb3JsZC5oZWxsbyhuYW1lOiBieXRlcykgLT4gYnl0ZXM6CmhlbGxvOgogICAgLy8gc21hcnRfY29udHJhY3RzL2hlbGxvX3dvcmxkL2NvbnRyYWN0LnB5OjYtNwogICAgLy8gQGFiaW1ldGhvZCgpCiAgICAvLyBkZWYgaGVsbG8oc2VsZiwgbmFtZTogU3RyaW5nKSAtPiBTdHJpbmc6CiAgICBwcm90byAxIDEKICAgIC8vIHNtYXJ0X2NvbnRyYWN0cy9oZWxsb193b3JsZC9jb250cmFjdC5weTo4CiAgICAvLyByZXR1cm4gIkhlbGxvLCAiICsgbmFtZQogICAgcHVzaGJ5dGVzICJIZWxsbywgIgogICAgZnJhbWVfZGlnIC0xCiAgICBjb25jYXQKICAgIHJldHN1Ygo=', 
        'I3ByYWdtYSB2ZXJzaW9uIDEwCiNwcmFnbWEgdHlwZXRyYWNrIGZhbHNlCgovLyBhbGdvcHkuYXJjNC5BUkM0Q29udHJhY3QuY2xlYXJfc3RhdGVfcHJvZ3JhbSgpIC0+IHVpbnQ2NDoKbWFpbjoKICAgIHB1c2hpbnQgMSAvLyAxCiAgICByZXR1cm4K', 
        { numByteSlice: 0, numUint: 2 }, { numByteSlice: 0, numUint: 0 });
   }

}
