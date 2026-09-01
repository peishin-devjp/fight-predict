const MULTIPLIER_TABLE = [
  { supportRate: 5, multiplier: 4.5 },
  { supportRate: 10, multiplier: 4.0 },
  { supportRate: 20, multiplier: 3.5 },
  { supportRate: 30, multiplier: 3.0 },
  { supportRate: 40, multiplier: 2.5 },
  { supportRate: 50, multiplier: 2.0 },
  { supportRate: 60, multiplier: 1.8 },
  { supportRate: 70, multiplier: 1.5 },
  { supportRate: 80, multiplier: 1.3 },
  { supportRate: 90, multiplier: 1.1 },
  { supportRate: 95, multiplier: 1.05 },
];

const MIN_SUPPORT_RATE = 5;
const MAX_SUPPORT_RATE = 95;
const MAX_MULTIPLIER = 4.5;
const MIN_MULTIPLIER = 1.05;

export const calculateDifficultyMultiplier = (
  supportRate: number
): number => {
  // 5%以下は最大倍率で固定
  if (supportRate <= MIN_SUPPORT_RATE) {
    return MAX_MULTIPLIER;
  }

  // 95%以上は最小倍率で固定
  if (supportRate >= MAX_SUPPORT_RATE) {
    return MIN_MULTIPLIER;
  }

  // supportRateを挟む2つの基準値を探す
  for (let i = 0; i < MULTIPLIER_TABLE.length - 1; i++) {
    const lower = MULTIPLIER_TABLE[i];
    const upper = MULTIPLIER_TABLE[i + 1];

    if (!lower || !upper) {
        continue;
    }

    if (
      supportRate >= lower.supportRate &&
      supportRate <= upper.supportRate
    ) {
      // 2つの基準値の間を線形補間
      const ratio =
        (supportRate - lower.supportRate) /
        (upper.supportRate - lower.supportRate);

      return (
        lower.multiplier +
        (upper.multiplier - lower.multiplier) * ratio
      );
    }
  }

  throw new Error("Unable to calculate difficulty multiplier");
};