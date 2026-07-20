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

export default app;