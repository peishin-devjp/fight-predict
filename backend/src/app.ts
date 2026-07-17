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
      date: "2026-09-20",
    },
  ]);
});

export default app;