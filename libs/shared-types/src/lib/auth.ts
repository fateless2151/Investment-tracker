export interface User {
  id: string;
  email: string;
  name: string | null;
  createdAt: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

/** Shape of the decoded JWT payload. */
export interface JwtPayload {
  sub: string;
  email: string;
}
