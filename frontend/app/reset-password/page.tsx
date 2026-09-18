"use client";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Suspense,
  SyntheticEvent,
  useState,
} from "react";

const MIN_PASSWORD_LENGTH = 8;

type ResetStatus =
  | "form"
  | "success"
  | "invalid";

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const isReset =
    searchParams.get("reset") === "1";

  const [newPassword, setNewPassword] =
    useState("");
  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState("");
  const [errorMessage, setErrorMessage] =
    useState("");
  const [isSubmitting, setIsSubmitting] =
    useState(false);
  const [status, setStatus] =
    useState<ResetStatus>(
      isReset
        ? "success"
        : token
          ? "form"
          : "invalid"
    );

  const handleSubmit = async (
    event: SyntheticEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setErrorMessage("");

    if (!token) {
      setStatus("invalid");
      return;
    }

    if (
      newPassword.length <
      MIN_PASSWORD_LENGTH
    ) {
      setErrorMessage(
        `パスワードは${MIN_PASSWORD_LENGTH}文字以上で入力してください。`
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(
        "確認用パスワードが一致しません。"
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        "http://localhost:3001/auth/reset-password",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            token,
            newPassword,
          }),
        }
      );

      if (!response.ok) {
        setStatus("invalid");
        return;
      }

      setStatus("success");

      // Reset成功後はURLからraw Tokenを除去
      router.replace(
        "/reset-password?reset=1"
      );
    } catch (error) {
      console.error(
        "Error resetting password:",
        error
      );

      setErrorMessage(
        "パスワードの変更に失敗しました。時間をおいて再度お試しください。"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "success") {
    return (
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">
          パスワード変更完了
        </h1>

        <p className="mb-4">
          パスワードを変更しました。新しいパスワードでログインしてください。
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

  if (status === "invalid") {
    return (
      <div className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-bold mb-6">
          パスワード再設定
        </h1>

        <p className="mb-4 text-red-600">
          パスワード再設定リンクが無効または期限切れです。
        </p>

        <Link
          href="/forgot-password"
          className="underline"
        >
          パスワード再設定メールを再送する
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">
        新しいパスワードを設定
      </h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="new-password"
            className="block mb-1"
          >
            新しいパスワード
          </label>

          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(event) =>
              setNewPassword(
                event.target.value
              )
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

        <div>
          <label
            htmlFor="confirm-password"
            className="block mb-1"
          >
            新しいパスワード（確認）
          </label>

          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(
                event.target.value
              )
            }
            required
            autoComplete="new-password"
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
            ? "変更中..."
            : "パスワードを変更"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto p-8">
          <p>読み込み中...</p>
        </div>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
