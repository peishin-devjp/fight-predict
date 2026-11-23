import PredictionForm from "@/components/PredictionForm";
import { notFound } from "next/navigation";
import { formatDate } from "@/lib/formatDate";
import { apiUrl } from "@/lib/api";

type MatchPageProps = {
  params: Promise<{
    id: string;
  }>;
};

type EventMatch = {
  id: number;
  matchCard: string;
  playerName1: string;
  playerName2: string;
  playerId1: number;
  playerId2: number;
  odds1: number;
  odds2: number;
};

type EventDetail = {
  id: number;
  name: string;
  date: string;
  deadline: string;
  matches: EventMatch[];
};

function isEventDetail(data: unknown): data is EventDetail {
  if (data === null || typeof data !== "object") {
    return false;
  }

  const event = data as Record<string, unknown>;

  return (
    typeof event.id === "number" &&
    typeof event.name === "string" &&
    typeof event.date === "string" &&
    typeof event.deadline === "string" &&
    Array.isArray(event.matches) &&
    event.matches.every(
      (match: unknown) =>
        match !== null &&
        typeof match === "object" &&
        typeof (match as EventMatch).id === "number" &&
        typeof (match as EventMatch).matchCard === "string" &&
        typeof (match as EventMatch).playerId1 === "number"
    )
  );
}

export default async function MatchPage({
  params,
}: MatchPageProps) {
  const { id } = await params;

  if (!/^[1-9]\d*$/.test(id)) {
    notFound();
  }

  let event: EventDetail | null = null;
  let error = false;

  try {
    const response = await fetch(apiUrl(`/events/${id}`), {
      cache: "no-store",
    });

    if (response.status === 404) {
      notFound();
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch event: ${response.status}`
      );
    }

    const data: unknown = await response.json();

    if (!isEventDetail(data)) {
      throw new Error("Invalid event detail response");
    }

    event = data;
  } catch (err) {
    // Next.jsの404例外は再送出する
    if (
      err !== null &&
      typeof err === "object" &&
      "digest" in err &&
      typeof err.digest === "string" &&
      err.digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")
    ) {
      throw err;
    }

    console.error("Failed to load event:", err);
    error = true;
  }

  if (error || !event) {
    return (
      <div className="max-w-5xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-4">
          大会情報
        </h1>
        <p role="alert" className="text-red-600">
          大会情報を取得できませんでした。
          時間をおいて再度お試しください。
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        {event.name}
      </h1>

      <div className="text-base p-4">
        <p className="mb-1">
          開催日: {formatDate(event.date)}
        </p>
        <p className="mb-1">
          予想締切: {formatDate(event.deadline)}
        </p>
      </div>

      {event.matches.length === 0 ? (
        <p className="text-gray-600">
          現在、登録されている試合はありません。
        </p>
      ) : (
        <PredictionForm
          eventId={event.id}
          matches={event.matches}
        />
      )}
    </div>
  );
}
