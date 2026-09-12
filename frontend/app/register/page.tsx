"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

const MIN_PASSWORD_LENGTH = 8;

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(
        `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "http://localhost:3001/auth/register",
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            email,
            password,
          }),
        }
      );

      if (!response.ok) {
        setErrorMessage(
          "新規登録に失敗しました。入力内容をご確認ください。"
        );
        return;
      }

      setIsRegistered(true);
    } catch (error) {
      console.error("Error registering:", error);

      setErrorMessage(
        "新規登録に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isRegistered) {
    return (
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">
          新規登録
        </h1>

        <p className="mb-4">
          登録しました。ログインしてください。
        </p>

        <Link
          href="/login"
          className="inline-block rounded bg-black px-4 py-2 text-white"
        >
          ログインへ
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">
        新規登録
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="name"
            className="block mb-1"
          >
            ユーザー名
          </label>

          <input
            id="name"
            type="text"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            required
            autoComplete="username"
            className="w-full border rounded px-3 py-2"
          />
        </div>

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
            minLength={MIN_PASSWORD_LENGTH}
            autoComplete="new-password"
            className="w-full border rounded px-3 py-2"
          />

          <p className="mt-1 text-sm text-gray-500">
            8文字以上で入力してください。
          </p>
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
            ? "登録中..."
            : "新規登録"}
        </button>
      </form>

      <p className="mt-6 text-sm">
        すでにアカウントをお持ちの方は{" "}
        <Link
          href="/login"
          className="underline"
        >
          ログイン
        </Link>
      </p>
    </div>
  );
}