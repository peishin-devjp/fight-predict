"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";

type PredictionFormProps = {
  matches: any[];
};

export default function PredictionForm(
  {matches}: PredictionFormProps
) {
  const [remainingPoint, setRemainingPoint] = useState(100);
  const [points, setPoints] = useState<Record<string, number>>({});

  const handlePointChange = (matchCard: string, point: number) => {
    const newPoints = {
      ...points,
      [matchCard]: point,
    };

    setPoints(newPoints);

    const total = Object.values(newPoints).reduce(
      (sum, value) => sum + value,
      0
    );

    setRemainingPoint(100 - total);
  };


  return (
    <>
      <div className="p-4">
        <p className={remainingPoint < 0 ? "text-red-500" : ""}>
          残り: {remainingPoint}pt</p>
      </div>

      {matches.map((match: any) => (
        <MatchCard
          key={match.matchCard}
          matchCard={match.matchCard}
          playerName1={match.playerName1}
          playerName2={match.playerName2}
          odds1={match.odds1}
          odds2={match.odds2}
          onPointChange={handlePointChange}
        />
      ))}
    </>
  );
}