"use client";

import MatchCard from "@/components/MatchCard";

type PredictionFormProps = {
  matches: any[];
};

export default function PredictionForm({
  matches,
}: PredictionFormProps) {
  return (
    <>
      {matches.map((match: any) => (
        <MatchCard
          key={match.matchCard}
          matchCard={match.matchCard}
          playerName1={match.playerName1}
          playerName2={match.playerName2}
          odds1={match.odds1}
          odds2={match.odds2}
          onPointChange={() => {}}
        />
      ))}
    </>
  );
}