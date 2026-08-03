"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";

type PredictionFormProps = {
  eventId: string;
  matches: any[];
};

export default function PredictionForm(
  {
    eventId,
    matches,
  }: PredictionFormProps
){
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

  const handleSave = async () => {
    try{
      const data ={
        eventId,
        predictions: [
          {
            fightId: "match1",
            winnerId: "fighter1",
            point: 20,
          },
        ],
      };

      const response = await fetch("http://localhost:3001/predictions", {
      method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      console.log(result);

    } catch (error) {
      console.error("Error saving predictions:", error);
    }
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

      <button
        className="mt-6 rounded bg-black px-6 py-3 text-white"
        onClick={handleSave}
      >
        予想を確定する
      </button>

    </>
  );
}