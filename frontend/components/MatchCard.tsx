type MatchCardProps = {
  matchCard: string;  //試合順(第〇試合)
  playerName1: string;  //選手1の名前
  playerName2: string;  //選手2の名前
  odds1: number;  //選手1のオッズ
  odds2: number;  //選手2のオッズ

  onPointChange: (matchCard: string, point: number) => void;  //配分ポイントの変更を通知するコールバック関数
};

export default function MatchCard({
  matchCard,
  playerName1,
  playerName2,
  odds1,
  odds2,
  //onPointChange
}: MatchCardProps) {
  return (
    <div className="border rounded-lg p-4 text-base mb-4">
      <h3 className="mb-2">{matchCard}</h3>


      <label className="flex items-start mt-1">
        <input
          type="radio"
          name={matchCard}
          className="mt-1"
        />
        <div className="ml-2">
          <p className="font-bold">{playerName1}</p>
          <p className="px-2">
            予想倍率：{odds1.toFixed(2)}
          </p>
        </div>
      </label>

      <p className="mx-10 my-3">vs</p>

      <label className="flex items-start mt-1 my-10">
        <input
          type="radio"
          name={matchCard}
          className="mt-1"
        />
        <div className="ml-2">
          <p className="font-bold">{playerName2}</p>
          <p className="px-2">
            予想倍率：{odds2.toFixed(2)}
          </p>
        </div>
      </label>

      {/*
      <div className="flex items-center mt-4">
        <p>配分ポイント</p>
        <input
          type="number"
          min={0}
          max={100}
          className="ml-3 w-20 rounded border p-1"
          onChange={(e) => onPointChange(matchCard, Number(e.target.value))}
        />
      </div>
      */}

    </div>
  );
}