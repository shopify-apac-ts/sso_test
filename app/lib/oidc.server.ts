import { SignJWT } from "jose";
import { getPrivateKey } from "./keys.server";

export function getBaseUrl(): string {
  return (process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function getClientId(): string {
  return process.env.CLIENT_ID || "my-sso-client-id";
}

export function getClientSecret(): string {
  return process.env.CLIENT_SECRET || "my-sso-client-secret";
}

export async function signIdToken({
  sub,
  email,
  clientId,
  nonce,
  issuer,
  shopifyClaims,
}: {
  sub: string;
  email: string;
  clientId: string;
  nonce?: string;
  issuer: string;
  shopifyClaims?: {
    given_name: string;
    family_name: string;
    phone_number?: string;
    addresses: unknown[];
    tags?: string;
  };
}): Promise<string> {
  const { key, kid } = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  const claims: Record<string, unknown> = {
    email,
    email_verified: true,
  };
  if (nonce) claims.nonce = nonce;
  if (shopifyClaims) {
    claims.given_name = shopifyClaims.given_name;
    claims.family_name = shopifyClaims.family_name;
    if (shopifyClaims.phone_number) claims.phone_number = shopifyClaims.phone_number;
    claims["urn:shopify:customer:addresses"] = shopifyClaims.addresses;
    if (shopifyClaims.tags) claims["urn:shopify:customer:tags"] = shopifyClaims.tags;
  }

  console.log("[oidc] JWT payload keys:", Object.keys(claims));
  console.log("[oidc] urn:shopify:customer:addresses present:", "urn:shopify:customer:addresses" in claims);
  const jwt = await new SignJWT(claims)
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuer)
    .setAudience(clientId)
    .setSubject(sub)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
  // Decode and log the actual JWT payload to verify claim names
  const payloadB64 = jwt.split(".")[1];
  const payload = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  console.log("[oidc] JWT payload claim keys:", Object.keys(payload));
  console.log("[oidc] JWT payload:", JSON.stringify(payload, null, 2));
  return jwt;
}

export async function signAccessToken({
  sub,
  email,
  issuer,
}: {
  sub: string;
  email: string;
  issuer: string;
}): Promise<string> {
  const { key, kid } = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({ sub, email })
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(issuer)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}
