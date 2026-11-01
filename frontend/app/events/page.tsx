import EventCard from "@/components/EventCard";
import { apiUrl } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function EventsPage() {

  const response = await fetch(apiUrl("/events"));
  const events = await response.json();
  console.log(events);

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        開催予定大会
      </h1>  

      {/* events.mapでbackendから取得したイベントを表示 */}
      {events.map((event: any) => (
        <EventCard
          key={event.id}
          eventId={event.id}
          eventName={event.name}
          mainCard={event.mainCard}
          eventDate={event.date}
        />
      ))}

    </div>
  );
}