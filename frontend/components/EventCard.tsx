import Link from "next/link";

type EventCardProps = {
  eventId: number;
  eventName: string;
  mainCard?: string;
  eventDate: string;
};

export default function EventCard({
  eventId,
  eventName,
  mainCard,
  eventDate,
}: EventCardProps) {
  return (
    <div className="border rounded-lg p-4 text-base mb-4">
      <h3>{eventName}</h3>

      {mainCard &&
        (<p className="font-bold mt-1">
          {mainCard}
        </p>
      )}

      <p className="mt-1">
        開催日：{eventDate}
      </p>

      <Link href={`/events/${eventId}`}
        className="inline-block mt-3 rounded px-3 py-2 bg-black text-white"
      >
        試合一覧を見る
      </Link>
    </div>
  );
}