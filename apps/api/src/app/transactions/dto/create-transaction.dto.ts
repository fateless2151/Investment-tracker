import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { AssetType, TransactionType } from '@prisma/client';
import type {
  CreateTransactionDto as ICreateTransactionDto,
  TransactionType as SharedTransactionType,
} from '@investment-tracker/shared-types';

export class CreateTransactionDto implements ICreateTransactionDto {
  @IsString()
  portfolioId!: string;

  @IsEnum(TransactionType)
  type!: SharedTransactionType;

  @IsString()
  symbol!: string;

  @IsNumber()
  @IsPositive()
  quantity!: number;

  @IsNumber()
  @Min(0)
  price!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fees?: number;

  @Matches(/^[A-Z]{3}$/, {
    message: 'currency must be a 3-letter ISO code (e.g. USD)',
  })
  currency!: string;

  @IsISO8601()
  executedAt!: string;

  /** Only used when a BUY opens a brand-new position. Defaults to STOCK. */
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;
}
