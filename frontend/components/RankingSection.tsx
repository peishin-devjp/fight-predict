type RankingSectionProps = {
  pattern: string;
  rankDetails: string;
};

export default function RankingSections({
  pattern,
  rankDetails
}: RankingSectionProps) {
  return (
    <div className="border rounded-lg p-4 text-base mb-4">
      <h3>#{pattern}</h3>
      <p className="font-bold mt-1">
        {rankDetails}
      </p>
      <button className="mt-3 rounded px-3 py-2 bg-black text-white">
        もっと見る
      </button>

    </div>
  );
}
