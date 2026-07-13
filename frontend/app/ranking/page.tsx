import RankingCards from "@/components/RankingCard";
import {recent3Ranking, latestRankings, yearlyRankings} from "@/data/ranking";

export default function RankingPage() {
  return (
    <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-2">
        ランキング一覧
        </h1>

        <div className="border rounded-lg p-4 text-base mb-4">
            <h2 className="mb-1">直近3大会ランキング</h2>
    
            {recent3Ranking.map((match) => (
                <RankingCards key={match.rank}
                rank={match.rank}
                userName={match.userName}
                point={match.point}
                />
            ))}

            <div className="flex justify-between">
                <p>
                <button className="mt-6 rounded bg-white px-6 py-3 text-black border border-black-300">
                    もっと見る
                </button>
                </p>
            </div>
        </div>


        <div className="border rounded-lg p-4 text-base mb-4">
            <h2 className="mb-1">最新大会ランキング</h2>
    
            {latestRankings.map((match) => (
                <RankingCards key={match.rank}
                rank={match.rank}
                userName={match.userName}
                point={match.point}
                />
            ))}

            <div className="flex justify-between">
                <p>
                <button className="mt-6 rounded bg-white px-6 py-3 text-black border border-black-300">
                    もっと見る
                </button>
                </p>
            </div>
        </div>


        <div className="border rounded-lg p-4 text-base mb-4">
            <h2 className="mb-1">年間ランキング</h2>
    
            {yearlyRankings .map((match) => (
                <RankingCards key={match.rank}
                rank={match.rank}
                userName={match.userName}
                point={match.point}
                />
            ))}

            <div className="flex justify-between">
                <p>
                <button className="mt-6 rounded bg-white px-6 py-3 text-black border border-black-300">
                    もっと見る
                </button>
                </p>
            </div>
        </div>




   </div>
  );
}