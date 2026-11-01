"use client";

import { useEffect, useState } from "react";
import MatchCard from "@/components/MatchCard";
import { apiUrl } from "@/lib/api";

const MAX_EVENT_POINTS = 100;
const MAX_FIGHT_POINTS = 50;

type Match = {
  id: number;
  matchCard: string;
  playerName1: string;
  playerName2: string;
  playerId1: number;
  playerId2: number;
  odds1: number;
  odds2: number;
};

type Prediction = {
  fightId: number;
  predictedWinnerId: number;
  point: number;
};

type PredictionLoadStatus =
  | "loading"
  | "ready"
  | "unauthenticated"
  | "session-expired"
  | "error";

type PredictionFormProps = {
  eventId: string | number;
  matches: Match[];
};

function buildPredictionState(
  matches: Match[],
  predictions: Prediction[]
): {
  points: Record<string, number | "">;
  winners: Record<string, number>;
  remainingPoint: number;
} {
  const points: Record<string, number | ""> = {};
  const winners: Record<string, number> = {};

  for (const prediction of predictions) {
    const match = matches.find(
      (candidate) => candidate.id === prediction.fightId
    );

    if (!match) {
      continue;
    }

    points[match.matchCard] = prediction.point;
    winners[match.matchCard] = prediction.predictedWinnerId;
  }

  const total = Object.values(points).reduce<number>(
    (sum, value) => sum + Number(value || 0),
    0
  );

  return {
    points,
    winners,
    remainingPoint: MAX_EVENT_POINTS - total,
  };
}

export default function PredictionForm({
  eventId,
  matches,
}: PredictionFormProps) {
  const [loadStatus, setLoadStatus] =
    useState<PredictionLoadStatus>("loading");

  const [remainingPoint, setRemainingPoint] =
    useState(MAX_EVENT_POINTS);

  const [saveMessage, setSaveMessage] = useState("");

  const [points, setPoints] =
    useState<Record<string, number | "">>({});

  const [winners, setWinners] =
    useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;

    const loadPredictions = async () => {
      setLoadStatus("loading");

      try {
        const response = await fetch(
          apiUrl(`/events/${eventId}/predictions`),
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          }
        );

        if (cancelled) {
          return;
        }

        if (response.status === 401) {
          let code: string | undefined;

          try {
            const result = await response.json();
            code =
              typeof result?.code === "string"
                ? result.code
                : undefined;
          } catch {
            code = undefined;
          }

          if (code === "SESSION_EXPIRED") {
            setLoadStatus("session-expired");
          } else {
            setLoadStatus("unauthenticated");
          }

          return;
        }

        if (!response.ok) {
          setLoadStatus("error");
          return;
        }

        const result = await response.json();

        if (!Array.isArray(result)) {
          setLoadStatus("error");
          return;
        }

        const loaded = buildPredictionState(
          matches,
          result as Prediction[]
        );

        if (cancelled) {
          return;
        }

        setPoints(loaded.points);
        setWinners(loaded.winners);
        setRemainingPoint(loaded.remainingPoint);
        setLoadStatus("ready");
      } catch (error) {
        console.error("Error loading predictions:", error);

        if (!cancelled) {
          setLoadStatus("error");
        }
      }
    };

    void loadPredictions();

    return () => {
      cancelled = true;
    };
  }, [eventId, matches]);

  const showMessage = (message: string) => {
    setSaveMessage(message);

    setTimeout(() => {
      setSaveMessage("");
    }, 3000);
  };

  const handlePointChange = (
    matchCard: string,
    point: number | ""
  ) => {
    if (loadStatus !== "ready") {
      return;
    }

    const newPoints = {
      ...points,
      [matchCard]: point,
    };

    setPoints(newPoints);

    const total = Object.values(newPoints).reduce<number>(
      (sum, value) => sum + Number(value || 0),
      0
    );

    setRemainingPoint(MAX_EVENT_POINTS - total);
  };

  const handleWinnerChange = (
    matchCard: string,
    winnerId: number
  ) => {
    if (loadStatus !== "ready") {
      return;
    }

    const newWinners = {
      ...winners,
      [matchCard]: winnerId,
    };

    setWinners(newWinners);
  };

  const handleSave = async () => {
    if (loadStatus !== "ready") {
      showMessage(
        "保存済み予想の確認が完了するまで保存できません。"
      );
      return;
    }

    const overPointLimit = Object.values(points).some(
      (point) => Number(point || 0) > MAX_FIGHT_POINTS
    );

    if (overPointLimit) {
      showMessage(
        `1試合に配分できるポイントは${MAX_FIGHT_POINTS}ptまでです。`
      );
      return;
    }

    if (remainingPoint < 0) {
      showMessage(
        `ポイントの合計が${MAX_EVENT_POINTS}を超えています。`
      );
      return;
    }

    try {
      const predictions = matches
        .filter((match) => {
          const winnerId = winners[match.matchCard];
          const point = points[match.matchCard];

          return (
            winnerId !== undefined &&
            point !== undefined &&
            point !== ""
          );
        })
        .map((match) => ({
          fightId: match.id,
          predictedWinnerId: winners[match.matchCard],
          point: Number(points[match.matchCard]),
        }));

      if (predictions.length === 0) {
        showMessage("保存する予想を入力してください。");
        return;
      }

      const response = await fetch(apiUrl("/predictions"), {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ predictions }),
      });

      let result: unknown;

      try {
        result = await response.json();
      } catch {
        result = undefined;
      }

      if (response.ok) {
        showMessage("予想を確定しました。");
      } else if (response.status === 401) {
        const code =
          typeof result === "object" &&
          result !== null &&
          "code" in result &&
          typeof result.code === "string"
            ? result.code
            : undefined;

        if (code === "SESSION_EXPIRED") {
          setLoadStatus("session-expired");
          showMessage(
            "セッションの有効期限が切れました。再度ログインしてください。"
          );
        } else {
          setLoadStatus("unauthenticated");
          showMessage(
            "予想を保存するにはログインが必要です。"
          );
        }
      } else {
        showMessage("予想の保存に失敗しました。");
      }
    } catch (error) {
      console.error("Error saving predictions:", error);
      showMessage("予想の保存に失敗しました。");
    }
  };

  if (loadStatus === "loading") {
    return (
      <div className="p-4">
        <p>保存済みの予想を読み込んでいます...</p>
      </div>
    );
  }

  if (loadStatus === "unauthenticated") {
    return (
      <div className="p-4">
        <p>
          予想を確認・保存するにはログインが必要です。
        </p>
      </div>
    );
  }

  if (loadStatus === "session-expired") {
    return (
      <div className="p-4">
        <p>
          セッションの有効期限が切れました。再度ログインしてください。
        </p>
      </div>
    );
  }

  if (loadStatus === "error") {
    return (
      <div className="p-4">
        <p>
          保存済みの予想を取得できませんでした。時間をおいて再度お試しください。
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="p-4">
        <p className={remainingPoint < 0 ? "text-red-500" : ""}>
          残り: {remainingPoint}pt
        </p>
      </div>

      {matches.map((match) => (
        <MatchCard
          key={match.matchCard}
          matchCard={match.matchCard}
          playerName1={match.playerName1}
          playerName2={match.playerName2}
          playerId1={match.playerId1}
          playerId2={match.playerId2}
          odds1={match.odds1}
          odds2={match.odds2}
          selectedWinnerId={winners[match.matchCard]}
          point={points[match.matchCard]}
          onPointChange={handlePointChange}
          onWinnerChange={handleWinnerChange}
        />
      ))}

      <button
        className="mt-6 rounded bg-black px-6 py-3 text-white"
        onClick={handleSave}
        disabled={loadStatus !== "ready"}
      >
        予想を確定する
      </button>

      {saveMessage && (
        <p className="mt-3 text-sm">{saveMessage}</p>
      )}
    </>
  );
}