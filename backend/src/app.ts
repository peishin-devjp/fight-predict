import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Fight Predict API");
});

app.get("/events", (req, res) => {
  res.json([
    {
      id: "ufc320",
      name: "UFC 320",
      mainCard: "アレックス・ペレイラ vs マゴメド・アンカラエフ",
      date: "2026-07-20",
    },
    {
      id: "rizin33",
      name: "RIZIN 33",
      mainCard: "朝倉海 vs 佐々木ウルカ",
      date: "2026-08-10",
    },
    {
      id: "deep101",
      name: "DEEP 101",
      mainCard: "タイガ vs 火の鳥",
      date: "2026-08-25",
    },
  ]);
});

app.get("/events/:id", (req, res) => {
  console.log(req.params.id);
  res.json({
    id: req.params.id,
    name: "UFC 320",
    date: "2026-07-20",
    deadline: "2026-07-20 16:00",
    matches: [
      {
        id: "match1",
        matchCard: "第1試合",
        playerName1: "アレックス・ペレイラ",
        playerName2: "マゴメド・アンカラエフ",
        odds1: 1.80,
        odds2: 2.10,
      },
    ]
  });
});


export default app;