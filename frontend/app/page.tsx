export default function Home() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        格闘技勝敗予想サイト
      </h1>

      <section className="mb-10">
        <h2 className="text-2xl font-semibold border-b pb-2 mb-4">
          開催予定試合
        </h2>

        <div className="border rounded-lg p-4">
          <p className="text-sm text-gray-500">UFC 320</p>

          <h3 className="text-xl font-bold mt-2">
            アレックス・ペレイラ vs マゴメド・アンカラエフ
          </h3>

          <p className="mt-2">
            開催日：2026/7/20
          </p>
        </div>
      </section>
    </div>
  );
}