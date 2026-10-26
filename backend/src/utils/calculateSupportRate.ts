import Decimal from "decimal.js";

type PredictionForSupportRate = {
  predictedWinnerId: number;
};

export const calculateSupportRateDecimal = (
  predictions: PredictionForSupportRate[],
  fighterId: number
): Decimal => {
  if (predictions.length === 0) {
    return new Decimal(0);
  }

  const supporterCount = predictions.filter(
    (prediction) => prediction.predictedWinnerId === fighterId
  ).length;

  return new Decimal(supporterCount)
    .div(predictions.length)
    .times(100);
};

export const calculateSupportRate = (
  predictions: PredictionForSupportRate[],
  fighterId: number
): number => {
  return calculateSupportRateDecimal(predictions, fighterId).toNumber();
};
