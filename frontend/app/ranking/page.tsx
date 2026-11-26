import RankingCards from "@/components/RankingCard";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

type RankingItem = {
  rank: number;
  userId: number;
  name: string;
  totalEarnedPoint: number;
};

type RankingResponse = {
  success: true;
  rankings: RankingItem[];
};

function isRankingResponse(
  data: unknown
): data is RankingResponse {
  if (data === null || typeof data !== "object") {
    return false;
  }

  const result = data as Record<string, unknown>;

  return (
    result.success === true &&
    Array.isArray(result.rankings) &&
    result.rankings.every(
      (item: unknown) =>
        item !== null &&
        typeof item === "object" &&
        typeof (item as RankingItem).rank === "number" &&
        typeof (item as RankingItem).userId === "number" &&
        typeof (item as RankingItem).name === "string" &&
        typeof (item as RankingItem).totalEarnedPoint === "number"
    )
  );
}

async function getRankings(): Promise<RankingItem[]> {
  const response = await fetch(apiUrl("/rankings"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch rankings: ${response.status}`
    );
  }

  const data: unknown = await response.json();

  if (!isRankingResponse(data)) {
    throw new Error("Invalid rankings response");
  }

  return data.rankings;
}

export default async function RankingPage() {
  let rankings: RankingItem[] = [];
  let error = false;

  try {
    rankings = await getRankings();
  } catch (err) {
    console.error("Failed to load rankings:", err);
    error = true;
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        ランキング一覧
      </h1>

      <section className="border rounded-lg p-4 mb-4">
        <h2 className="text-xl font-semibold mb-4">
          直近3大会ランキング
        </h2>

        {error ? (
          <p role="alert" className="text-red-600">
            ランキング情報を取得できませんでした。
            時間をおいて再度お試しください。
          </p>
        ) : rankings.length === 0 ? (
          <p className="text-gray-600">
            現在、ランキングデータはありません。
          </p>
        ) : (
          rankings.map((item) => (
            <RankingCards
              key={item.userId}
              rank={item.rank}
              userName={item.name}
              point={item.totalEarnedPoint}
            />
          ))
        )}
      </section>
    </div>
  );
}
