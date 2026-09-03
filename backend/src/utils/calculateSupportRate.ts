type PredictionForSupportRate = {
  predictedWinnerId: number;
};

export const calculateSupportRate = (
  predictions: PredictionForSupportRate[],
  fighterId: number
): number => {
  if (predictions.length === 0) {
    return 0;
  }

  const supporterCount = predictions.filter(
    (prediction) => prediction.predictedWinnerId === fighterId
  ).length;

  return (supporterCount / predictions.length) * 100;
};