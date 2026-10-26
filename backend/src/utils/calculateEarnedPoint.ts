import Decimal from "decimal.js";

export const calculateEarnedPointDecimal = (
  point: Decimal.Value,
  multiplier: Decimal.Value
): Decimal => {
  return new Decimal(point)
    .times(multiplier)
    .toDecimalPlaces(1, Decimal.ROUND_HALF_UP);
};

export const calculateEarnedPoint = (
  point: number,
  multiplier: number
): number => {
  return calculateEarnedPointDecimal(point, multiplier).toNumber();
};
