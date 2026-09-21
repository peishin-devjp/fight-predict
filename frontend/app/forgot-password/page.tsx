"use client";

import Link from "next/link";
import { SyntheticEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [isSubmitted, setIsSubmitted] =
    useState(false);

  const handleSubmit = async (
    event: SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(
        "http://localhost:3001/auth/forgot-password",
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
        if (response.status === 429) {
          setErrorMessage(
            "再設定の試行回数が多すぎます。しばらく時間をおいてから再度お試しください。"
          );
          return;
        }

        setErrorMessage(
          "パスワード再設定メールの送信に失敗しました。時間をおいて再度お試しください。"
        );
        return;
      }

      setIsSubmitted(true);
    } catch (error) {
      console.error(
        "Error requesting password reset:",
        error
      );

      setErrorMessage(
        "パスワード再設定メールの送信に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">
          パスワード再設定
        </h1>

        <p className="mb-4">
          該当するアカウントが存在する場合、パスワード再設定メールを送信しました。
        </p>

        <Link
          href="/login"
          className="underline"
        >
          ログインへ戻る
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">
        パスワード再設定
      </h1>

      <p className="mb-6">
        登録したメールアドレスを入力してください。
      </p>

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

        {errorMessage && (
          <p className="text-red-600">
            {errorMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting
            ? "送信中..."
            : "再設定メールを送信"}
        </button>
      </form>

      <p className="mt-6 text-sm">
        <Link
          href="/login"
          className="underline"
        >
          ログインへ戻る
        </Link>
      </p>
    </div>
  );
}
