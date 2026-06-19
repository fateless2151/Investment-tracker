import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
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

  @IsString()
  currency!: string;

  @IsISO8601()
  executedAt!: string;

  /** Only used when a BUY opens a brand-new position. Defaults to STOCK. */
  @IsOptional()
  @IsEnum(AssetType)
  assetType?: AssetType;
}
