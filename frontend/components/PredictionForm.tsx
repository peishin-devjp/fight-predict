"use client";

import { useState } from "react";
import MatchCard from "@/components/MatchCard";

const MAX_EVENT_POINTS = 100;
const MAX_FIGHT_POINTS = 50;

type PredictionFormProps = {
  eventId: string;
  matches: any[];
  initialPredictions: any[];
};

export default function PredictionForm(
  {
    eventId,
    matches,
    initialPredictions,
  }: PredictionFormProps
){
  const initialPoints: Record<string, number | ""> = Object.fromEntries(
    initialPredictions.map((prediction: any) => {
      const match = matches.find(
        (match: any) => match.id === prediction.fightId
      );

      return [
        match?.matchCard,
        prediction.point,
      ];
    })
  );

  const initialWinners: Record<string, number> = Object.fromEntries(
    initialPredictions.map((prediction: any) => {
      const match = matches.find(
        (match: any) => match.id === prediction.fightId
      );

      return [
        match?.matchCard,
        prediction.predictedWinnerId,
      ];
    })
  );

  const initialTotal = Object.values(initialPoints).reduce<number>(
    (sum, value) => sum + Number(value || 0),
    0
  );

  const [remainingPoint, setRemainingPoint] =
    useState(MAX_EVENT_POINTS - initialTotal);

  const [saveMessage, setSaveMessage] = useState("");

  const [points, setPoints] =
    useState<Record<string, number | "">>(initialPoints);

  const [winners, setWinners] =
    useState<Record<string, number>>(initialWinners);
  
  const showMessage = (message: string) => {
    setSaveMessage(message);

    setTimeout(() => {
      setSaveMessage("");
    }, 3000);
  };

  const handlePointChange = (matchCard: string, point: number | "") => {
    const newPoints = {
      ...points,
      [matchCard]: point,
    };

    setPoints(newPoints);

    const total = Object.values(newPoints).reduce<number>(
      (sum, value) => sum + Number(value || 0),
      0
    );

    setRemainingPoint(MAX_EVENT_POINTS - total);
  };

  const handleWinnerChange = (matchCard: string, winnerId: number) => {
    const newWinners = {
      ...winners,
      [matchCard]: winnerId,
    };

    setWinners(newWinners);
  };

  const handleSave = async () => {

    const overPointLimit = Object.values(points).some(
      (point) => Number(point || 0) > MAX_FIGHT_POINTS
    );

    if (overPointLimit) {
      showMessage(`1試合に配分できるポイントは${MAX_FIGHT_POINTS}ptまでです。`);
      return;
    }

    if (remainingPoint < 0) {
      showMessage(`ポイントの合計が${MAX_EVENT_POINTS}を超えています。`);
      return;
    }

    try{
      const data ={
        userId: 1,
        predictions: matches.map((match: any) => (
          {
            fightId: match.id,
            predictedWinnerId: winners[match.matchCard],
            point:
              points[match.matchCard] === "" ? 0 : Number(points[match.matchCard]),
          }
        )),
      };

      const response = await fetch("http://localhost:3001/predictions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        showMessage("予想を確定しました。");
      } else {
        showMessage("予想の保存に失敗しました。");
      }

      console.log(result);
    } catch (error) {
      console.error("Error saving predictions:", error);

      showMessage("予想の保存に失敗しました。");
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
          playerId1={match.playerId1}
          playerId2={match.playerId2}
          odds1={match.odds1}
          odds2={match.odds2}
          selectedWinnerId={winners[match.matchCard]}
          point={points[match.matchCard]}
          onPointChange={handlePointChange}
          onWinnerChange={handleWinnerChange}
        />
      ))}

      <button
        className="mt-6 rounded bg-black px-6 py-3 text-white"
        onClick={handleSave}
      >
        予想を確定する
      </button>

      {saveMessage && (
        <p className="mt-3 text-sm">{saveMessage}</p>
      )}

    </>
  );
}