import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import type { LoginDto as ILoginDto } from '@investment-tracker/shared-types';

export class LoginDto implements ILoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
