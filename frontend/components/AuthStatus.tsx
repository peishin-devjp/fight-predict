"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type AuthUser = {
  id: number;
  name: string;
  email: string;
};

export default function AuthStatus() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const response = await fetch(
          "http://localhost:3001/auth/me",
          {
            credentials: "include",
          }
        );

        if (!response.ok) {
          setUser(null);
          return;
        }

        const result = await response.json();
        setUser(result.user);
      } catch (error) {
        console.error("Error fetching current user:", error);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCurrentUser();

    window.addEventListener(
      "auth-change",
      fetchCurrentUser
    );

    return () => {
      window.removeEventListener(
        "auth-change",
        fetchCurrentUser
      );
    };
  }, []);

  const handleLogout = async () => {
    try {
      const response = await fetch(
        "http://localhost:3001/auth/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );

      if (response.ok) {
        setUser(null);
      }
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  if (isLoading) {
    return null;
  }

  if (user) {
    return (
      <div className="flex items-center gap-4">
        <span>{user.name}</span>

        <button
          type="button"
          onClick={handleLogout}
          className="text-sm underline"
        >
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/login"
        className="text-sm underline"
      >
        ログイン
      </Link>

      <Link
        href="/register"
        className="text-sm underline"
      >
        新規登録
      </Link>
    </div>
  );
}