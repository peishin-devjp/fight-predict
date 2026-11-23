export default function RankingLoading() {
  return (
    <div className="max-w-5xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">
        ランキング一覧
      </h1>

      <p role="status" className="text-gray-600">
        ランキング情報を読み込み中...
      </p>
    </div>
  );
}
