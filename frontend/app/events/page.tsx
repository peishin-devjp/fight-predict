import EventCard from "@/components/EventCard";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

type EventItem = {
  id: number;
  name: string;
  date: string;
  mainCard: string | null;
};

async function getEvents(): Promise<EventItem[]> {
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

  return data;
}

export default async function EventsPage() {
  let events: EventItem[] = [];
  let error = false;

  try {
    events = await getEvents();
  } catch (err) {
    console.error("Failed to load events:", err);
    error = true;
  }

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        開催予定大会
      </h1>

      {error ? (
        <p role="alert" className="text-red-600">
          大会情報を取得できませんでした。
          時間をおいて再度お試しください。
        </p>
      ) : events.length === 0 ? (
        <p className="text-gray-600">
          現在、登録されている大会はありません。
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
    </div>
  );
}
