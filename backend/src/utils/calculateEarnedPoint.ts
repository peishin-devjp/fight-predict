const roundToOneDecimal = (value: number): number => {
  return Math.round((value + Number.EPSILON) * 10) / 10;
};

export const calculateEarnedPoint = (
  point: number,
  multiplier: number
): number => {
  return roundToOneDecimal(point * multiplier);
};