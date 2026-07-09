"use client";   // This is a client component
import { useState } from "react";
import MatchCard from "@/components/MatchCard";

export default function MatchPage() {
  const [remainingPoint, setRemainingPoint] = useState(100);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        UFC 320
      </h1>

      <div className="text-base p-4">
        <p className="mb-1">開催日: 2026/07/20 (日) 17:00</p>
        <p className="mb-1">予想締切: 2026/07/20 (日) 16:00</p>
        <p className="text-red-500">残り: {remainingPoint}pt</p>
      </div>

      <MatchCard
        matchCard="第4試合"
        playerName1="アレックス・ペレイラ"
        playerName2="マゴメド・アンカラエフ"
        odds1={1.5}
        odds2={2.5}
      />

      <MatchCard
        matchCard="第3試合"
        playerName1=" Mr.サタン"
        playerName2="ブウ・マジン"
        odds1={2.0}
        odds2={1.8}
      />

      <MatchCard
        matchCard="第2試合"
        playerName1="スーパー・フライ"
        playerName2="ドン・フライ"
        odds1={1.8}
        odds2={2.2}
      />
    
      <MatchCard
        matchCard="第1試合"
        playerName1="桜木花道"
        playerName2="流川楓"
        odds1={1.5}
        odds2={2.5}
      />
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