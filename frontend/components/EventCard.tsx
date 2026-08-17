type EventCardProps = {
  eventName: string;
  mainCard?: string;
  eventDate: string;
};

export default function EventCard({
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

      <button className="mt-3 rounded px-3 py-2 bg-black text-white">
        試合一覧を見る
      </button>
    </div>
  );
}