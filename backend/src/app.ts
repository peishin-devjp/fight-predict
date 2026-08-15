import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

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

app.get("/events/:id", async (req, res) => {
  const eventId = Number(req.params.id);

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!event) {
    return res.status(404).json({
      message: "Event not found",
    });
  }

const fights = await prisma.fight.findMany({
  where: {
    eventId: eventId,
  },
});

const matches = await Promise.all(
  fights.map(async (fight, index) => {
    const fighter1 = await prisma.fighter.findUnique({
      where: {
        id: fight.fighter1Id,
      },
    });

    const fighter2 = await prisma.fighter.findUnique({
      where: {
        id: fight.fighter2Id,
      },
    });

    return {
      id: fight.id,
      matchCard: `第${index + 1}試合`,
      playerName1: fighter1?.name,
      playerName2: fighter2?.name,
      playerId1: fight.fighter1Id,
      playerId2: fight.fighter2Id,
      odds1: 1.80,
      odds2: 2.10,
    };
  })
);

return res.json({
    id: event.id,
    name: event.name,
    date: event.date,
    deadline: event.deadline,
    matches,
  });
});

app.post("/predictions", async (req, res) => {
  const { userId, predictions } = req.body;

  if (!userId || !Array.isArray(predictions)) {
    return res.status(400).json({
      success: false,
       message: "Invalid request",
      });
  }

  const invalidPoint = predictions.some(
    (prediction: any) => prediction.point < 0
  );

  if (invalidPoint) {
    return res.status(400).json({
      success: false,
      message: "Invalid point",
    });
  }

  const savedPredictions = await Promise.all(
    predictions.map((prediction: any) =>
      prisma.prediction.upsert({
        where: {
          userId_fightId: {
            userId: userId,
            fightId: prediction.fightId,
          },
        },
        update: {
          predictedWinnerId: prediction.predictedWinnerId,
          point: prediction.point,
        },
        create: {
          userId: userId,
          fightId: prediction.fightId,
          predictedWinnerId: prediction.predictedWinnerId,
          point: prediction.point,
        },
      })
    )
  );

  console.log(savedPredictions);

  return res.status(200).json({
    success: true,
    message: "Predictions saved",
    result: savedPredictions,
  });
});

app.post("/test-event", async (req, res) => {
  const event = await prisma.event.create({
    data: {
      name: "TEST EVENT",
      date: new Date("2026-09-01T18:00:00"),
      deadline: new Date("2026-09-01T17:00:00"),
    },
  });

  console.log(event);

  return res.status(200).json(event);
});

app.post("/test-user", async (req, res) => {
  const user = await prisma.user.create({
    data: {
      name: "TEST USER",
      email: "test@example.com",
      password: "test-password",
    },
  });

  return res.status(200).json(user);
});

app.post("/test-fighters", async (req, res) => {
  const fighter1 = await prisma.fighter.create({
    data: {
      name: "アレックス・ペレイラ",
    },
  });

  const fighter2 = await prisma.fighter.create({
    data: {
      name: "マゴメド・アンカラエフ",
    },
  });

  return res.status(200).json({
    fighter1,
    fighter2,
  });
});

app.post("/test-fight", async (req, res) => {
  const fight = await prisma.fight.create({
    data: {
      eventId: 1,
      fighter1Id: 1,
      fighter2Id: 2,
    },
  });

  return res.status(200).json(fight);
});

app.post("/test-fighters-2", async (req, res) => {
  const fighter3 = await prisma.fighter.create({
    data: {
      name: "TEST FIGHTER 3",
    },
  });

  const fighter4 = await prisma.fighter.create({
    data: {
      name: "TEST FIGHTER 4",
    },
  });

  return res.status(200).json({
    fighter3,
    fighter4,
  });
});

app.post("/test-fight-2", async (req, res) => {
  const fight = await prisma.fight.create({
    data: {
      eventId: 1,
      fighter1Id: 3,
      fighter2Id: 4,
    },
  });

  return res.status(200).json(fight);
});

export default app;