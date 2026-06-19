import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import type { RegisterDto as IRegisterDto } from '@investment-tracker/shared-types';

export class RegisterDto implements IRegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  name?: string;
}
