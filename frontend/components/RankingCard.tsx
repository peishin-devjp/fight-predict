type RankingCardProps = {
  rank: number;
  userName: string;
  point: number;
};

export default function RankingCards({
  rank,
  userName,
  point
}: RankingCardProps) {
  return (
    <div className="p-4 text-base mb-4">
      <h3>#{rank} {userName}</h3>
      <p className="font-bold mt-1">{point} pt</p>
    </div>
  );
}