import { generateKeyPair, exportJWK, type KeyLike } from "jose";

let _privateKey: KeyLike | undefined;
let _publicKey: KeyLike | undefined;
let _publicJwk: Record<string, unknown> | undefined;
const KEY_ID = "sso-test-key-1";

let _initPromise: Promise<void> | undefined;

async function initialize() {
  const { privateKey, publicKey } = await generateKeyPair("RS256", {
    modulusLength: 2048,
  });
  _privateKey = privateKey;
  _publicKey = publicKey;
  const jwk = await exportJWK(publicKey);
  _publicJwk = { ...jwk, kid: KEY_ID, use: "sig", alg: "RS256" };
}

function ensureInitialized() {
  if (!_initPromise) {
    _initPromise = initialize();
  }
  return _initPromise;
}

export async function getPrivateKey() {
  await ensureInitialized();
  return { key: _privateKey!, kid: KEY_ID };
}

export async function getPublicKey() {
  await ensureInitialized();
  return _publicKey!;
}

export async function getJWKS() {
  await ensureInitialized();
  return { keys: [_publicJwk!] };
}
