import { compare, hash } from "bcryptjs";

/** bcryptjs, 10 rounds (roadmap contract). */
export async function hashPassword(plain: string): Promise<string> {
  return hash(plain, 10);
}

export async function verifyPassword(plain: string, hashValue: string): Promise<boolean> {
  return compare(plain, hashValue);
}
