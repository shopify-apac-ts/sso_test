// In-memory store for testing (reset on server restart)

export interface AuthCodeData {
  userId: string;
  email: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  nonce?: string;
  createdAt: number;
}

export interface RefreshTokenData {
  userId: string;
  email: string;
  clientId: string;
  scope: string;
}

const authCodes = new Map<string, AuthCodeData>();
const refreshTokens = new Map<string, RefreshTokenData>();

export function storeAuthCode(code: string, data: AuthCodeData) {
  authCodes.set(code, data);
  // Auto-delete after 10 minutes
  setTimeout(() => authCodes.delete(code), 10 * 60 * 1000);
}

export function getAuthCode(code: string): AuthCodeData | undefined {
  return authCodes.get(code);
}

export function deleteAuthCode(code: string) {
  authCodes.delete(code);
}

export function storeRefreshToken(token: string, data: RefreshTokenData) {
  refreshTokens.set(token, data);
  // Auto-delete after 24 hours (setTimeout max is ~24.8 days as a 32-bit signed integer)
  setTimeout(() => refreshTokens.delete(token), 24 * 60 * 60 * 1000);
}

export function getRefreshToken(token: string): RefreshTokenData | undefined {
  return refreshTokens.get(token);
}

export function deleteRefreshToken(token: string) {
  refreshTokens.delete(token);
}
