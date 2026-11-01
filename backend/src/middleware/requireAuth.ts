import { NextFunction, Request, Response } from "express";
import prisma from "../lib/prisma";
import { hashSessionToken } from "../utils/sessionToken";

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
      code: "AUTH_REQUIRED",
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
      code: "AUTH_REQUIRED",
      message: "Unauthorized",
    });
  }

  // Sessionの有効期限を確認
  if (session.expiresAt <= new Date()) {
    return res.status(401).json({
      success: false,
      code: "SESSION_EXPIRED",
      message: "Unauthorized",
    });
  }

  // 認証済みUser IDを後続処理へ渡す
  res.locals.userId = session.userId;

  return next();
};