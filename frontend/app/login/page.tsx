"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
  const [resendMessage, setResendMessage] = useState("");
  const [isResending, setIsResending] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setResendMessage("");
    setIsEmailNotVerified(false);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        "http://localhost:3001/auth/login",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
          }),
        }
      );

      if (!response.ok) {
        let result: {
          code?: string;
        } = {};

        try {
          result = await response.json();
        } catch {
          // JSONでないエラー応答は通常エラーとして扱う
        }

        if (result.code === "EMAIL_NOT_VERIFIED") {
          setIsEmailNotVerified(true);

          setErrorMessage(
            "メールアドレスの確認が完了していません。"
          );

          return;
        }

        setErrorMessage(
          "メールアドレスまたはパスワードが正しくありません。"
        );

        return;
      }
      
      window.dispatchEvent(new Event("auth-change"));
      
      router.push("/");
      router.refresh();
    } catch (error) {
      console.error("Error logging in:", error);

      setErrorMessage(
        "ログインに失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    if (!email.trim()) {
      setResendMessage(
        "メールアドレスを入力してください。"
      );
      return;
    }

    setResendMessage("");
    setIsResending(true);

    try {
      const response = await fetch(
        "http://localhost:3001/auth/resend-verification",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
          }),
        }
      );

      if (!response.ok) {
        setResendMessage(
          "確認メールの送信に失敗しました。時間をおいて再度お試しください。"
        );
        return;
      }

      setResendMessage(
        "確認メールを送信しました。"
      );
    } catch (error) {
      console.error(
        "Error resending verification email:",
        error
      );

      setResendMessage(
        "確認メールの送信に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">
        ログイン
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="email"
            className="block mb-1"
          >
            メールアドレス
          </label>

          <input
            id="email"
            type="email"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            required
            autoComplete="email"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block mb-1"
          >
            パスワード
          </label>

          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            required
            autoComplete="current-password"
            className="w-full border rounded px-3 py-2"
          />
        </div>

        {errorMessage && (
          <div className="space-y-2">
            <p className="text-red-600">
              {errorMessage}
            </p>

            {isEmailNotVerified && (
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isResending}
                className="text-sm underline disabled:opacity-50"
              >
                {isResending
                  ? "確認メールを送信中..."
                  : "確認メールを再送"}
              </button>
            )}

            {resendMessage && (
              <p className="text-sm">
                {resendMessage}
              </p>
            )}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting
            ? "ログイン中..."
            : "ログイン"}
        </button>
      </form>

      <p className="mt-4 text-sm">
        <Link
          href="/forgot-password"
          className="underline"
        >
          パスワードを忘れた方
        </Link>
      </p>

      <p className="mt-6 text-sm">
        アカウントをお持ちでない方は{" "}
        <Link
          href="/register"
          className="underline"
        >
          新規登録
        </Link>
      </p>
    </div>
  );
}