import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type {
  AuthResponse,
  LoginDto,
  RegisterDto,
} from '@investment-tracker/shared-types';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(_dto: RegisterDto): Promise<AuthResponse> {
    // TODO: hash password (bcrypt/argon2), persist user, issue token.
    throw new Error('Not implemented');
  }

  async login(_dto: LoginDto): Promise<AuthResponse> {
    // TODO: look up user, verify password hash, then issue a token.
    throw new UnauthorizedException('Not implemented');
  }

  private sign(userId: string, email: string): string {
    return this.jwt.sign({ sub: userId, email });
  }
}
