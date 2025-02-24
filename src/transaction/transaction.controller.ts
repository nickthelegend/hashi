import { Body, Controller, Get, Logger, Param, Post } from "@nestjs/common"
import { WalletService } from "../wallet/wallet.service"
import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { EncoderFactory } from "../chain/encoder.factory"
import { Crafter } from "../chain/crafter.role"
import { ConfigService } from "@nestjs/config"
import { CrafterFactory } from "../chain/crafter.factory"
import { ApiTags } from "@nestjs/swagger"
import { TransactionService } from "./transaction.service"

// DTO for required parameters
export class CreateAssetRequiredDto {
    @IsString()
    from: string;

    @IsString()
    unit: string;

    @IsNumber()
    @Type(() => Number)
    decimals: number;

    @IsNumber()
    @Type(() => Number)
    totalTokens: number;
}

// DTO for optional parameters
export class CreateAssetOptionalDto {
    @IsString()
    @IsOptional()
    assetName?: string;

    @IsString()
    @IsOptional()
    url?: string;

    @IsBoolean()
    @IsOptional()
    defaultFrozen?: boolean;

    @IsString()
    @IsOptional()
    managerAddress?: string;

    @IsString()
    @IsOptional()
    reserveAddress?: string;

    @IsString()
    @IsOptional()
    freezeAddress?: string;

    @IsString()
    @IsOptional()
    clawbackAddress?: string;
}

// Combined DTO
export class CreateAssetDto extends CreateAssetRequiredDto implements Partial<CreateAssetOptionalDto> {
    assetName?: string;
    url?: string;
    defaultFrozen?: boolean;
    managerAddress?: string;
    reserveAddress?: string;
    freezeAddress?: string;
    clawbackAddress?: string;
}

@ApiTags("Transaction")
@Controller()
export class Transaction {
    constructor(private readonly walletService: WalletService, private readonly configService: ConfigService, private readonly txnService: TransactionService) {}


    @Post("payment")
    async makePayment(@Body() body: { from: string, to: string, amt: number }): Promise<{txnId:string}> {
        const amount = Number(body.amt)
        return { txnId : await this.txnService.makePayment(body.from, body.to, amount)}
        
    }

    @Post("asset")
    async createAsset(@Body() body: CreateAssetDto): Promise<{ assetId: string}> {

        const decimals = Number(body.decimals)
        const totalTokens = Number(body.totalTokens)
        const params = {
            assetName: body.assetName,
            url: body.url,
            defaultFrozen: body.defaultFrozen,
            managerAddress: body.managerAddress,
            reserveAddress: body.reserveAddress,
            freezeAddress: body.freezeAddress,
            clawbackAddress: body.clawbackAddress
        }

        const assetId = await this.txnService.asset(body.from, body.unit, decimals, totalTokens, params)

        return { assetId: assetId.toString() }
    }

    @Post("asset-transfer")
    async transferAsset(@Body() body: { assetId: number, from: string, to: string, amount: number }): Promise<{ txnId: string }> {

        const assetId = Number(body.assetId)
        const amount = Number(body.amount)

        return { txnId : await this.txnService.transferToken(assetId, body.from, body.to, amount)}
    }

   @Post("create-application")
   async createApplication(@Body() body: { from: string, approvalProgram: string, clearProgram: string, globalSchema: { numByteSlice: number, numUint: number }, localSchema: { numByteSlice: number, numUint: number } }): Promise<string> {
    //    const globalSchema = body.globalSchema
    //    const localSchema = body.localSchema
       
       
    //    return await this.txnService.createApplication(body.from, body.approvalProgram, body.clearProgram, globalSchema, localSchema)
       return await this.txnService.createApplication('test', 
        'CjEbQQA0gAQCvs4RNhoAjgEAA4EAQzEZFEQxGEQ2GgFXAgCIACBJFRZXBgJMUIAEFR98dUxQsIEBQzEZQP/UMRgURIEBQ4oBAYAHSGVsbG8sIIv/UIk=',
        'CoEBQw==', 
        { numByteSlice: 0, numUint: 0 }, { numByteSlice: 0, numUint: 0 });
   }

}
