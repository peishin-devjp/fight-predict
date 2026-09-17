import { createHash, randomBytes } from "crypto";

const PASSWORD_RESET_TOKEN_BYTES = 32;

export const PASSWORD_RESET_TOKEN_MAX_AGE_MS =
  60 * 60 * 1000;

export const generatePasswordResetToken = (): string => {
  return randomBytes(
    PASSWORD_RESET_TOKEN_BYTES
  ).toString("hex");
};

export const hashPasswordResetToken = (
  token: string
): string => {
  return createHash("sha256")
    .update(token)
    .digest("hex");
};

export const getPasswordResetTokenExpiresAt =
  (): Date => {
    return new Date(
      Date.now() +
        PASSWORD_RESET_TOKEN_MAX_AGE_MS
    );
  };
