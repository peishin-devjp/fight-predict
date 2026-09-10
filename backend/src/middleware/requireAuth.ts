import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { hashSessionToken } from "../utils/sessionToken";

const prisma = new PrismaClient();

export const requireAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const sessionToken = req.cookies?.fp_session;

  // Session Cookieがない場合
  if (
    typeof sessionToken !== "string" ||
    sessionToken.length === 0
  ) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  // raw Tokenをhash化してDB検索
  const tokenHash = hashSessionToken(sessionToken);

  const session = await prisma.session.findUnique({
    where: {
      tokenHash,
    },
  });

  if (!session) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  // Sessionの有効期限を確認
  if (session.expiresAt <= new Date()) {
    await prisma.session.delete({
      where: {
        id: session.id,
      },
    });

    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }

  // 認証済みUser IDを後続処理へ渡す
  res.locals.userId = session.userId;

  return next();
};