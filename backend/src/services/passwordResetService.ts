import {
  PasswordResetToken,
  PrismaClient,
} from "@prisma/client";
import {
  generatePasswordResetToken,
  getPasswordResetTokenExpiresAt,
  hashPasswordResetToken,
} from "../utils/passwordResetToken";

type IssuedPasswordResetToken = {
  rawToken: string;
  expiresAt: Date;
};

export const issuePasswordResetToken = async (
  prisma: PrismaClient,
  userId: number
): Promise<IssuedPasswordResetToken> => {
  const rawToken =
    generatePasswordResetToken();

  const tokenHash =
    hashPasswordResetToken(rawToken);

  const expiresAt =
    getPasswordResetTokenExpiresAt();

  await prisma.passwordResetToken.upsert({
    where: {
      userId,
    },
    update: {
      tokenHash,
      expiresAt,
    },
    create: {
      tokenHash,
      userId,
      expiresAt,
    },
  });

  return {
    rawToken,
    expiresAt,
  };
};

export const findValidPasswordResetToken =
  async (
    prisma: PrismaClient,
    rawToken: string
  ): Promise<PasswordResetToken | null> => {
    const tokenHash =
      hashPasswordResetToken(rawToken);

    const token =
      await prisma.passwordResetToken.findUnique({
        where: {
          tokenHash,
        },
      });

    if (!token) {
      return null;
    }

    if (token.expiresAt <= new Date()) {
      return null;
    }

    return token;
  };
