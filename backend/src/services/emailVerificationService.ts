import {
  EmailVerificationToken,
  PrismaClient,
} from "@prisma/client";
import {
  generateEmailVerificationToken,
  getEmailVerificationTokenExpiresAt,
  hashEmailVerificationToken,
} from "../utils/emailVerificationToken";

type IssuedEmailVerificationToken = {
  rawToken: string;
  expiresAt: Date;
};

export const issueEmailVerificationToken = async (
  prisma: PrismaClient,
  userId: number
): Promise<IssuedEmailVerificationToken> => {
  const rawToken =
    generateEmailVerificationToken();

  const tokenHash =
    hashEmailVerificationToken(rawToken);

  const expiresAt =
    getEmailVerificationTokenExpiresAt();

  await prisma.emailVerificationToken.upsert({
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

export const findValidEmailVerificationToken =
  async (
    prisma: PrismaClient,
    rawToken: string
  ): Promise<EmailVerificationToken | null> => {
    const tokenHash =
      hashEmailVerificationToken(rawToken);

    const token =
      await prisma.emailVerificationToken.findUnique({
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