import PredictionForm from "@/components/PredictionForm";

export default async function MatchPage() {
  const response = await fetch("http://localhost:3001/events/ufc320");
  const event = await response.json();

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        {event.name}
      </h1>

      <div className="text-base p-4">
        <p className="mb-1">開催日: {event.date}</p>
        <p className="mb-1">予想締切: {event.deadline}</p>
      </div>

      <PredictionForm
        matches={event.matches}
       />

      <div className="flex justify-between">
        <button className="mt-6 rounded bg-white px-6 py-3 text-black border border-black-300">
          一時保存
        </button>

        <button className="mt-6 rounded bg-black px-6 py-3 text-white">
          予想を確定する
        </button>
      </div>
    </div>
  );
}