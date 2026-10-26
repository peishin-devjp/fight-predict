const SETTLED_FIGHT_STATUSES = new Set([
  "finished",
  "draw",
  "no_contest",
  "cancelled",
]);

type FightForSettlement = {
  status: string;
};

export const isEventSettled = (
  fights: FightForSettlement[]
): boolean => {
  if (fights.length === 0) {
    return false;
  }

  return fights.every((fight) =>
    SETTLED_FIGHT_STATUSES.has(fight.status)
  );
};