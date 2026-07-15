import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send("Fight Predict API");
});

export default app;