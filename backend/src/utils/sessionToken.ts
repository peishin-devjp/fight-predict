import { createHash, randomBytes } from "crypto";

const SESSION_TOKEN_BYTES = 32;

export const SESSION_MAX_AGE_MS =
  7 * 24 * 60 * 60 * 1000;

export const generateSessionToken = (): string => {
  return randomBytes(SESSION_TOKEN_BYTES).toString("hex");
};

export const hashSessionToken = (
  token: string
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};