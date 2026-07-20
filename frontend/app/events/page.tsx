import EventCard from "@/components/EventCard";

export default async function EventsPage() {

  const response = await fetch("http://localhost:3001/events");
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
          eventName={event.name}
          mainCard={event.mainCard}
          eventDate={event.date}
        />
      ))}

    </div>
  );
}