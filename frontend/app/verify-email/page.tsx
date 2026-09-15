"use client";

import Link from "next/link";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
} from "react";

type VerificationStatus =
  | "verifying"
  | "success"
  | "error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const token = searchParams.get("token");
  const isVerified =
    searchParams.get("verified") === "1";

  const [status, setStatus] =
    useState<VerificationStatus>(
      isVerified ? "success" : "verifying"
    );

  const hasRequested = useRef(false);

  useEffect(() => {
    // 確認完了後のreloadではAPIを再実行しない
    if (isVerified) {
      setStatus("success");
      return;
    }

    // 同一mount中の重複API実行を防止
    if (hasRequested.current) {
      return;
    }

    hasRequested.current = true;

    if (!token) {
      setStatus("error");
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await fetch(
          "http://localhost:3001/auth/verify-email",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              token,
            }),
          }
        );

        if (!response.ok) {
          setStatus("error");
          return;
        }

        setStatus("success");

        // 確認成功後はURLからraw Tokenを除去
        router.replace(
          "/verify-email?verified=1"
        );
      } catch (error) {
        console.error(
          "Error verifying email:",
          error
        );

        setStatus("error");
      }
    };

    verifyEmail();
  }, [isVerified, router, token]);

  return (
    <div className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">
        メールアドレス確認
      </h1>

      {status === "verifying" && (
        <p>
          メールアドレスを確認しています...
        </p>
      )}

      {status === "success" && (
        <>
          <p className="mb-4">
            メールアドレスの確認が完了しました。ログインしてください。
          </p>

          <Link
            href="/login"
            className="inline-block rounded bg-black px-4 py-2 text-white"
          >
            ログインへ
          </Link>
        </>
      )}

      {status === "error" && (
        <p className="text-red-600">
          確認リンクが無効または期限切れです。
        </p>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto p-8">
          <p>
            メールアドレスを確認しています...
          </p>
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}