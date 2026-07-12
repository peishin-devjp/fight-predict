"use client";   // This is a client component
import { useState } from "react";
import MatchCard from "@/components/MatchCard";
import {event, matches} from "@/data/events";

export default function MatchPage() {
  const [remainingPoint, setRemainingPoint] = useState(100);
  const [points, setPoints] = useState<Record<string, number>>({});

  const handlePointChange = (matchCard: string, point: number) => {
    const newPoints = {
      ...points,
       [matchCard]: point
    };

    setPoints(newPoints);

    const total = Object.values(newPoints).reduce(
      (sum, value) => sum + value,
      0
    );

    setRemainingPoint(100 - total);
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        {event.name}
      </h1>

      <div className="text-base p-4">
        <p className="mb-1">開催日: {event.date}</p>
        <p className="mb-1">予想締切: {event.deadline}</p>
        <p className={remainingPoint < 0 ? "text-red-500" : ""}>
          残り: {remainingPoint}pt
        </p>
        {/* <p>{JSON.stringify(points)}</p> //残りpt表示 */}
      </div>
      
      {/* <p>{matches.length}</p>  //events.matchesの配列数を表示 */}
    
      {matches.map((match) => (   // matches配列をループしてMatchCardを表示)
        <MatchCard key={match.matchCard}
          matchCard={match.matchCard}
          playerName1={match.playerName1}
          playerName2={match.playerName2}
          odds1={match.odds1}
          odds2={match.odds2}
          onPointChange={handlePointChange}
        />
      ))}


      <div className="flex justify-between">
        <p>
          <button className="mt-6 rounded bg-white px-6 py-3 text-black border border-black-300">
            一時保存
          </button>
        </p>
        <p>
          <button className="mt-6 rounded bg-black px-6 py-3 text-white">
            予想を確定する
          </button>
        </p>
    </div>

   </div>
  );
}