"use client";

import { useEffect, useRef, useState } from "react";
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
  deadline: string;
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
  deadline,
}: PredictionFormProps) {
  const [loadStatus, setLoadStatus] =
    useState<PredictionLoadStatus>("loading");

  const [remainingPoint, setRemainingPoint] =
    useState(MAX_EVENT_POINTS);

  const [saveMessage, setSaveMessage] = useState("");
  const messageTimerRef = useRef<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);

  const [points, setPoints] =
    useState<Record<string, number | "">>({});

  const [winners, setWinners] =
    useState<Record<string, number>>({});

  const [savedPredictions, setSavedPredictions] =
    useState<Prediction[]>([]);

  const [isDeadlinePassed, setIsDeadlinePassed] =
    useState(false);

  const [isBackendDeadlinePassed, setIsBackendDeadlinePassed] =
    useState(false);

  const isPredictionClosed =
    isDeadlinePassed || isBackendDeadlinePassed;


  useEffect(() => {
    const deadlineTime = new Date(deadline).getTime();

    const updateDeadlineStatus = () => {
      setIsDeadlinePassed(
        !Number.isFinite(deadlineTime) ||
        Date.now() >= deadlineTime
      );
    };

    updateDeadlineStatus();

    const timer = window.setInterval(
      updateDeadlineStatus,
      250
    );

    return () => {
      window.clearInterval(timer);
    };
  }, [deadline]);

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

        setSavedPredictions(result as Prediction[]);
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

  useEffect(() => {
    return () => {
      if (messageTimerRef.current !== null) {
        window.clearTimeout(messageTimerRef.current);
        messageTimerRef.current = null;
      }
    };
  }, []);

  const showMessage = (
    message: string,
    persistent = false
  ) => {
    if (messageTimerRef.current !== null) {
      window.clearTimeout(messageTimerRef.current);
      messageTimerRef.current = null;
    }

    setSaveMessage(message);

    if (!persistent) {
      messageTimerRef.current = window.setTimeout(() => {
        setSaveMessage("");
        messageTimerRef.current = null;
      }, 3000);
    }
  };

  const isDeadlineClosed = () => {
    const deadlineTime = new Date(deadline).getTime();

    return (
      isPredictionClosed ||
      !Number.isFinite(deadlineTime) ||
      Date.now() >= deadlineTime
    );
  };

  const handlePointChange = (
    matchCard: string,
    point: number | ""
  ) => {
    if (
      loadStatus !== "ready" ||
      isDeadlineClosed() ||
      savingRef.current
    ) {
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
    if (
      loadStatus !== "ready" ||
      isDeadlineClosed() ||
      savingRef.current
    ) {
      return;
    }

    const newWinners = {
      ...winners,
      [matchCard]: winnerId,
    };

    setWinners(newWinners);
  };

  const handleSave = async () => {
    if (savingRef.current) {
      return;
    }

    if (isDeadlineClosed()) {
      setIsDeadlinePassed(true);
      return;
    }

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

      savingRef.current = true;
      setIsSaving(true);

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
        setSavedPredictions((previous) => {
          const updated = new Map(
            previous.map((prediction) => [
              prediction.fightId,
              prediction,
            ])
          );

          for (const prediction of predictions) {
            updated.set(prediction.fightId, prediction);
          }

          return Array.from(updated.values());
        });

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
      } else if (
        response.status === 403 &&
        typeof result === "object" &&
        result !== null &&
        "code" in result &&
        result.code === "PREDICTION_DEADLINE_PASSED"
      ) {
        setIsBackendDeadlinePassed(true);
        showMessage(
          "予想締切を過ぎたため、予想は保存されませんでした。",
          true
        );
      } else {
        showMessage("予想の保存に失敗しました。");
      }
    } catch (error) {
      console.error("Error saving predictions:", error);
      showMessage("予想の保存に失敗しました。");
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const canViewPredictions = loadStatus === "ready";
  const canPredict =
    canViewPredictions &&
    !isPredictionClosed &&
    !isSaving;

  const savedState = buildPredictionState(
    matches,
    savedPredictions
  );

  const displayPoints = isPredictionClosed
    ? savedState.points
    : points;

  const displayWinners = isPredictionClosed
    ? savedState.winners
    : winners;

  const displayRemainingPoint = isPredictionClosed
    ? savedState.remainingPoint
    : remainingPoint;

  const statusMessage: string | null =
    loadStatus === "loading"
      ? "保存済みの予想を読み込んでいます..."
      : loadStatus === "unauthenticated"
        ? "予想を確認・保存するにはログインが必要です。"
        : loadStatus === "session-expired"
          ? "セッションの有効期限が切れました。再度ログインしてください。"
          : loadStatus === "error"
            ? "保存済みの予想を取得できませんでした。時間をおいて再度お試しください。"
            : isPredictionClosed
              ? "予想の受付は終了しました。"
              : null;

  return (
    <>
      {statusMessage && (
        <div className="p-4" role="status">
          <p>{statusMessage}</p>
        </div>
      )}

      {canViewPredictions && (
        <div className="p-4">
          <p className={displayRemainingPoint < 0 ? "text-red-500" : ""}>
            残り: {displayRemainingPoint}pt
          </p>
        </div>
      )}

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
          selectedWinnerId={canViewPredictions ? displayWinners[match.matchCard] : undefined}
          point={canViewPredictions ? displayPoints[match.matchCard] : undefined}
          onPointChange={handlePointChange}
          onWinnerChange={handleWinnerChange}
          disabled={!canPredict}
        />
      ))}

      {canViewPredictions && !isPredictionClosed && (
        <button
          className="mt-6 rounded bg-black px-6 py-3 text-white disabled:opacity-50"
          onClick={handleSave}
          disabled={!canPredict}
        >
          {isSaving ? "保存中..." : "予想を確定する"}
        </button>
      )}

      {isSaving && isPredictionClosed && (
        <p className="mt-3 text-sm" role="status">
          保存結果を確認しています...
        </p>
      )}

      {saveMessage && (
        <p className="mt-3 text-sm">{saveMessage}</p>
      )}
    </>
  );
}