import { Resend } from "resend";

type SendVerificationEmailParams = {
  to: string;
  rawToken: string;
};

const getRequiredEnv = (
  name: "RESEND_API_KEY" | "EMAIL_FROM" | "FRONTEND_ORIGIN"
): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `${name} is not configured`
    );
  }

  return value;
};

export const sendVerificationEmail = async ({
  to,
  rawToken,
}: SendVerificationEmailParams): Promise<void> => {
  const apiKey =
    getRequiredEnv("RESEND_API_KEY");

  const emailFrom =
    getRequiredEnv("EMAIL_FROM");

  const frontendOrigin =
    getRequiredEnv("FRONTEND_ORIGIN");

  const verificationUrl = new URL(
    "/verify-email",
    frontendOrigin
  );

  verificationUrl.searchParams.set(
    "token",
    rawToken
  );

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: emailFrom,
    to,
    subject: "Fight Predict メールアドレス確認",
    text: [
      "Fight Predictへの登録ありがとうございます。",
      "",
      "以下のURLからメールアドレスを確認してください。",
      verificationUrl.toString(),
      "",
      "このURLの有効期限は24時間です。",
    ].join("\n"),
  });

  if (error) {
    throw new Error(
      "Failed to send verification email"
    );
  }
};