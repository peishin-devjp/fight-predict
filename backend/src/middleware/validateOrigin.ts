import { Request, Response, NextFunction } from "express";

const STATE_CHANGING_METHODS = new Set([
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
]);

const DEVELOPMENT_FRONTEND_ORIGIN = "http://localhost:3000";

export const validateOrigin = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // GET / HEAD等のsafe methodはOrigin検証対象外
  if (!STATE_CHANGING_METHODS.has(req.method)) {
    return next();
  }

  const origin = req.get("origin");

  const allowedOrigins = new Set<string>();

  if (process.env.NODE_ENV === "production") {
    // 本番環境では設定されたFrontend Originのみ許可
    if (process.env.FRONTEND_ORIGIN) {
      allowedOrigins.add(process.env.FRONTEND_ORIGIN);
    }
  } else {
    // 開発環境ではNext.jsのlocalhostを許可
    allowedOrigins.add(DEVELOPMENT_FRONTEND_ORIGIN);

    if (process.env.FRONTEND_ORIGIN) {
      allowedOrigins.add(process.env.FRONTEND_ORIGIN);
    }
  }

  // Originがある場合は許可Originとの完全一致を要求
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden",
      });
    }

    return next();
  }

  // Originなし + Session CookieありはCSRF対策として拒否
  const sessionToken = req.cookies?.fp_session;

  if (
    typeof sessionToken === "string" &&
    sessionToken.length > 0
  ) {
    return res.status(403).json({
      success: false,
      message: "Forbidden",
    });
  }

  // Originなし + Session Cookieなしはcurl・テスト・server-to-server用途を許可
  return next();
};
