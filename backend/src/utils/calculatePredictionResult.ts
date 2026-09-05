import { calculateDifficultyMultiplier } from "./difficultyMultiplier";
import { calculateSupportRate } from "./calculateSupportRate";
import { calculateEarnedPoint } from "./calculateEarnedPoint";

type PredictionForResult = {
  id: number;
  fightId: number;
  predictedWinnerId: number;
  point: number;
};

type FightForResult = {
  id: number;
  status: string;
  winnerId: number | null;
};

type PredictionForSupportRate = {
  predictedWinnerId: number;
};

export type PredictionResult = {
  predictionId: number;
  fightId: number;
  result: "HIT" | "MISS" | "REFUND" | "NOT_SETTLED";
  supportRate: number;
  multiplier: number;
  earnedPoint: number | null;
};

export const calculatePredictionResult = (
  prediction: PredictionForResult,
  fight: FightForResult,
  fightPredictions: PredictionForSupportRate[]
): PredictionResult => {
  // 予想人数から支持率を計算
  const supportRate = calculateSupportRate(
    fightPredictions,
    prediction.predictedWinnerId
  );

  // 支持率から難易度倍率を計算
  const multiplier = calculateDifficultyMultiplier(supportRate);

  let result: PredictionResult["result"];
  let earnedPoint: number | null;

  switch (fight.status) {
    case "finished":
      if (prediction.predictedWinnerId === fight.winnerId) {
        result = "HIT";
        earnedPoint = calculateEarnedPoint(
          prediction.point,
          multiplier
        );
      } else {
        result = "MISS";
        earnedPoint = 0;
      }
      break;

    case "draw":
    case "no_contest":
    case "cancelled":
      result = "REFUND";
      earnedPoint = prediction.point;
      break;

    case "scheduled":
      result = "NOT_SETTLED";
      earnedPoint = null;
      break;

    default:
      throw new Error(`Unsupported fight status: ${fight.status}`);
  }

  return {
    predictionId: prediction.id,
    fightId: fight.id,
    result,
    supportRate,
    multiplier,
    earnedPoint,
  };
};