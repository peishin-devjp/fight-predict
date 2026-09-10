import PredictionForm from "@/components/PredictionForm";
import { notFound } from "next/navigation";
import {formatDate} from "@/lib/formatDate";
import { cookies } from "next/headers";

type MatchPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function MatchPage({
  params
}: MatchPageProps) {
  const { id } = await params;
  const response = await fetch(`http://localhost:3001/events/${id}`);
  
  if (response.status === 404) {
    notFound();
  }
  
  const event = await response.json();

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("fp_session")?.value;

  const predictionResponse = await fetch(
    `http://localhost:3001/events/${id}/predictions`,
    {
      headers: sessionToken
        ? {
            Cookie: `fp_session=${sessionToken}`,
          }
        : {},
      cache: "no-store",
    }
  );

  const initialPredictions = predictionResponse.ok
    ? await predictionResponse.json()
    : [];

  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">
        {event.name}
      </h1>

      <div className="text-base p-4">
        <p className="mb-1">開催日: {formatDate(event.date)}</p>
        <p className="mb-1">予想締切: {formatDate(event.deadline)}</p>
      </div>

      <PredictionForm
        eventId={event.id}
        matches={event.matches}
        initialPredictions={initialPredictions}
       />

      <div className="flex justify-between">
        <button className="mt-6 rounded bg-white px-6 py-3 text-black border border-black-300">
          一時保存
        </button>
      </div>
    </div>
  );
}