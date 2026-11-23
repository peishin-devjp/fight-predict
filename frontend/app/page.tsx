import Link from "next/link";
import EventCard from "@/components/EventCard";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

type EventItem = {
  id: number;
  name: string;
  date: string;
  mainCard: string | null;
};

async function getUpcomingEvents(): Promise<EventItem[]> {
  const response = await fetch(apiUrl("/events"), {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  const data: unknown = await response.json();

  if (
    !Array.isArray(data) ||
    !data.every(
      (item): item is EventItem =>
        item !== null &&
        typeof item === "object" &&
        typeof item.id === "number" &&
        typeof item.name === "string" &&
        typeof item.date === "string" &&
        (typeof item.mainCard === "string" ||
          item.mainCard === null)
    )
  ) {
    throw new Error("Invalid events response");
  }

  const now = Date.now();

  return data
    .filter((event) => {
      const date = Date.parse(event.date);
      return Number.isFinite(date) && date >= now;
    })
    .sort(
      (a, b) =>
        Date.parse(a.date) - Date.parse(b.date)
    )
    .slice(0, 3);
}

export default async function Home() {
  let events: EventItem[] = [];
  let error = false;

  try {
    events = await getUpcomingEvents();
  } catch (err) {
    console.error("Failed to load upcoming events:", err);
    error = true;
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        Fight Predict
      </h1>

      <p className="mb-10 text-lg text-gray-600">
        格闘技の勝敗予想を
        <br />
        みんなで楽しもう
      </p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold border-b pb-2 mb-4">
          開催予定大会
        </h2>

        {error ? (
          <p role="alert" className="text-red-600">
            大会情報を取得できませんでした。
            時間をおいて再度お試しください。
          </p>
        ) : events.length === 0 ? (
          <p className="text-gray-600">
            現在、開催予定の大会はありません。
          </p>
        ) : (
          events.map((event) => (
            <EventCard
              key={event.id}
              eventId={event.id}
              eventName={event.name}
              mainCard={event.mainCard ?? undefined}
              eventDate={event.date}
            />
          ))
        )}

        <Link
          href="/events"
          className="inline-block mt-6 rounded bg-black px-6 py-3 text-white"
        >
          大会一覧を見る
        </Link>
      </section>

      <section>
        <h2 className="text-2xl font-semibold border-b pb-2 mb-4">
          ランキング
        </h2>

        <Link
          href="/ranking"
          className="inline-block mt-3 rounded bg-black px-3 py-2 text-white"
        >
          ランキングを見る
        </Link>
      </section>
    </div>
  );
}
