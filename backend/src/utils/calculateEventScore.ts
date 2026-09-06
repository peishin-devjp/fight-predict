import { calculatePredictionResult } from "./calculatePredictionResult";

type PredictionForEventScore = {
  id: number;
  userId: number;
  fightId: number;
  predictedWinnerId: number;
  point: number;
};

type FightForEventScore = {
  id: number;
  status: string;
  winnerId: number | null;
};

export type EventScoreResult = {
  isSettled: boolean;
  totalEarnedPoint: number | null;
  predictions: ReturnType<typeof calculatePredictionResult>[];
};

export const calculateEventScore = (
  userPredictions: PredictionForEventScore[],
  eventFights: FightForEventScore[],
  allEventPredictions: PredictionForEventScore[]
): EventScoreResult => {
  // Predictionごとの結果を計算
  const predictionResults = userPredictions.map((prediction) => {
    const fight = eventFights.find(
      (eventFight) => eventFight.id === prediction.fightId
    );

    if (!fight) {
      throw new Error(
        `Fight not found for prediction: ${prediction.id}`
      );
    }

    // 同じFightの全Predictionを支持率計算に使用
    const fightPredictions = allEventPredictions.filter(
      (eventPrediction) =>
        eventPrediction.fightId === prediction.fightId
    );

    return calculatePredictionResult(
      prediction,
      fight,
      fightPredictions
    );
  });

  // UserのPredictionがすべて確定しているか判定
  const isSettled = predictionResults.every(
    (predictionResult) =>
      predictionResult.result !== "NOT_SETTLED"
  );

  if (!isSettled) {
    return {
      isSettled: false,
      totalEarnedPoint: null,
      predictions: predictionResults,
    };
  }

  // Fight単位で丸め済みのearnedPointを合計
  const totalEarnedPoint =
    predictionResults.reduce(
      (total, predictionResult) =>
        total +
        Math.round((predictionResult.earnedPoint ?? 0) * 10),
      0
    ) / 10;

  return {
    isSettled: true,
    totalEarnedPoint,
    predictions: predictionResults,
  };
};