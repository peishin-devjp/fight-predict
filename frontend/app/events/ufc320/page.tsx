import MatchCard from "@/components/MatchCard";

export default function MatchPage() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        UFC 320
      </h1>
      <p className="text-lg px-2 mb-4">2026/07/20</p>

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

   </div>
  );
}