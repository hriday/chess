import { hash, verify } from "@node-rs/argon2";

export function hashPassword(pw: string): Promise<string> {
  return hash(pw, { memoryCost: 19456, timeCost: 2, parallelism: 1 });
}

export function verifyPassword(hashed: string, pw: string): Promise<boolean> {
  return verify(hashed, pw).catch(() => false);
}
