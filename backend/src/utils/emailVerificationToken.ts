import { createHash, randomBytes } from "crypto";

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;

export const EMAIL_VERIFICATION_TOKEN_MAX_AGE_MS =
  24 * 60 * 60 * 1000;

export const generateEmailVerificationToken = (): string => {
  return randomBytes(
    EMAIL_VERIFICATION_TOKEN_BYTES
  ).toString("hex");
};

export const hashEmailVerificationToken = (
  token: string
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};

export const getEmailVerificationTokenExpiresAt =
  (): Date => {
    return new Date(
      Date.now() +
        EMAIL_VERIFICATION_TOKEN_MAX_AGE_MS
    );
  };