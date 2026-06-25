import {
  IsEnum,
  IsNumber,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { AssetType as PrismaAssetType } from '@prisma/client';
import type {
  AssetType,
  CreatePositionDto as ICreatePositionDto,
} from '@investment-tracker/shared-types';

export class CreatePositionDto implements ICreatePositionDto {
  @IsString()
  symbol!: string;

  @IsEnum(PrismaAssetType)
  assetType!: AssetType;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  avgCostBasis!: number;

  // The price for an equity comes back in the instrument's listing currency
  // (Finnhub doesn't convert), so a position must be stored in that currency.
  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. USD)',
  })
  currency!: string;
}
