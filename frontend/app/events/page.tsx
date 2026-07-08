import EventCard from "@/components/EventCard";

export default function EventsPage() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        開催予定大会
      </h1>

      <EventCard
        eventName="UFC 320"
        mainCard="アレックス・ペレイラ vs マゴメド・アンカラエフ"
        eventDate="2026/07/20"
      />

      <EventCard
        eventName="RIZIN 33"
        mainCard="朝倉海 vs 佐々木ウルカ"
        eventDate="2026/08/10"
      />

      <EventCard
        eventName="DEEP 101"
        mainCard="タイガ vs 火の鳥"
        eventDate="2026/08/25"
      />
    </div>
  );
}