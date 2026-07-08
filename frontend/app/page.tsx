import Link from "next/link";
import EventCard from "@/components/EventCard";

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1  className="text-3xl font-bold mb-8">
        Fight Predict
      </h1>
      <p className="mb-10 text-lg text-gray-600">
        格闘技の勝敗予想を<br />
        みんなで楽しもう
      </p>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold border-b pb-2 mb-4">
          注目試合
        </h2>

        <div className="mt-4 border rounded-lg p-4">
          <p className="text-base font-semibold text-gray-600">UFC 320</p>

          <h3 className="text-xl font-bold mt-2">
            アレックス・ペレイラ vs マゴメド・アンカラエフ
          </h3>
          <p className="mt-2">
            開催日：2026/7/20
          </p>
          <button className="mt-3 rounded px-3 py-2 bg-black text-white">
            勝敗を予想する
          </button>
        </div>

        <h2 className="mt-10 text-2xl font-semibold border-b pb-2 mb-4">
          開催予定大会
        </h2>

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

        <Link href="/events">
          <button className="mt-6 rounded bg-black px-6 py-3 text-white">
            他大会を見る
          </button>
        </Link>

      </section>
    </div>
  );
}