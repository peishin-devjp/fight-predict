import { rateLimit } from "express-rate-limit";

const RATE_LIMIT_MESSAGE = {
  success: false,
  message:
    "Too many requests. Please try again later.",
};

// Login：認証失敗5回 / 15分
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,

  // EMAIL_NOT_VERIFIEDはPassword認証自体は成功しているため
  // Login失敗回数には含めない
  requestWasSuccessful: (_req, res) => {
    return (
      res.statusCode < 400 ||
      res.locals.loginFailureReason ===
        "EMAIL_NOT_VERIFIED"
    );
  },

  message: RATE_LIMIT_MESSAGE,
});

// Register：全試行5回 / 1時間
export const registerRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

// Verification resend：全試行1回 / 1分
export const verificationResendMinuteRateLimiter =
  rateLimit({
    windowMs: 60 * 1000,
    limit: 1,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });

// Verification resend：全試行5回 / 1時間
export const verificationResendHourRateLimiter =
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: RATE_LIMIT_MESSAGE,
  });

// Forgot Password：全試行5回 / 1時間
export const forgotPasswordRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});

// Reset Password：全試行10回 / 15分
export const resetPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: RATE_LIMIT_MESSAGE,
});