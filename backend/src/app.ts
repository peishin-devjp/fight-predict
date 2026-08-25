import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient();

const sendError = (
  res: express.Response,
  status: number,
  message: string
) => {
  return res.status(status).json({
    success: false,
    message,
  });
};

app.use(cors());
app.use(express.json());


// ==============================
// API動作確認
// ==============================
app.get("/", (req, res) => {
  res.send("Fight Predict API");
});


// ==============================
// 大会一覧取得
// ==============================
app.get("/events", async (req, res) => {
  const events = await prisma.event.findMany();

  const eventsWithMainCard = await Promise.all(
    events.map(async (event) => {
      const mainFight = await prisma.fight.findFirst({
        where: {
          eventId: event.id,
        },
        orderBy: {
          id: "asc",
        },
      });

      if (!mainFight) {
        return {
          ...event,
          mainCard: null,
        };
      }

      const fighter1 = await prisma.fighter.findUnique({
        where: {
          id: mainFight.fighter1Id,
        },
      });

      const fighter2 = mainFight.fighter2Id ? await prisma.fighter.findUnique({
        where: {
          id: mainFight.fighter2Id,
        },
      }) : null;

      return {
        ...event,
        mainCard: `${fighter1?.name} vs ${fighter2?.name}`,
      };
    })
  );

  return res.json(eventsWithMainCard);
});


// ==============================
// 大会詳細取得
// ==============================
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

      const fighter2 = fight.fighter2Id ? await prisma.fighter.findUnique({
        where: {
          id: fight.fighter2Id,
        },
      }) : null;

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
    }
  ));

  return res.json({
      id: event.id,
      name: event.name,
      date: event.date,
      deadline: event.deadline,
      matches,
  });
});


// ==============================
// 予測保存・更新
// ==============================
app.post("/predictions", async (req, res) => {
  const { userId, predictions } = req.body;

  // リクエスト内容を検証

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

  // 送信された試合から対象大会を特定

  const fightIds = predictions.map(
    (prediction: any) => prediction.fightId
  );

  const fights = await prisma.fight.findMany({
    where: {
      id: {
        in: fightIds,
      },
    },
  });

  if (fights.length !== fightIds.length) {
    return res.status(400).json({
      success: false,
      message: "Invalid fight",
    });
  }

  const eventIds = [...new Set(fights.map((fight) => fight.eventId))];

  if (eventIds.length !== 1) {
    return res.status(400).json({
      success: false,
      message: "Predictions must belong to one event",
    });
  }

  const eventId = eventIds[0];

  if (eventId === undefined) {
    return res.status(400).json({
      success: false,
      message: "Event not found",
    });
  }

  // 対象大会の試合と既存Predictionを取得

  const eventFights = await prisma.fight.findMany({
    where: {
      eventId: eventId,
    },
  });

  const eventFightIds = eventFights.map((fight) => fight.id);

  const existingPredictions = await prisma.prediction.findMany({
    where: {
      userId: userId,
      fightId: {
        in: eventFightIds,
      },
    },
  });

  // 更新後の状態を作成し、大会合計が100pt以内か検証

  const mergedPredictions = eventFightIds.map((fightId) => {
    const incomingPrediction = predictions.find(
      (prediction: any) => prediction.fightId === fightId
    );

    if (incomingPrediction) {
      return {
        fightId: fightId,
        point: Number(incomingPrediction.point),
      };
    }

    const existingPrediction = existingPredictions.find(
      (prediction) => prediction.fightId === fightId
    );

    return {
      fightId: fightId,
      point: existingPrediction?.point ?? 0,
    };
  });

  const totalPoint = mergedPredictions.reduce(
    (sum, prediction) => sum + prediction.point,
    0
  );

  if (totalPoint > 100) {
    return res.status(400).json({
      success: false,
      message: "Total points exceed 100",
    });
  }

  // Predictionを試合ごとに新規保存または更新

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


// ==============================
// テストデータ作成用API
// TODO: 本番運用前に削除する
// ==============================
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


// ==============================
// 保存済み予想取得
// ==============================
app.get("/events/:id/predictions", async (req, res) => {
  const eventId = Number(req.params.id);
  const userId = Number(req.query.userId);

  if (!userId) {
    return res.status(400).json({
      message: "userId is required",
    });
  }

  const fights = await prisma.fight.findMany({
    where: {
      eventId: eventId,
    },
  });

  const fightIds = fights.map((fight) => fight.id);

  const predictions = await prisma.prediction.findMany({
    where: {
      userId: userId,
      fightId: {
        in: fightIds,
      },
    },
  });

  return res.json(predictions);
});


// ==============================
// Fight result update
// ==============================
app.patch("/fights/:id/result", async (req, res) => {
  const fightId = Number(req.params.id);

  if (!Number.isInteger(fightId) || fightId <= 0) {
    return sendError(res, 400, "Invalid fight ID");
  }

  const fight = await prisma.fight.findUnique({
    where: {
      id: fightId,
    },
  });

  if (!fight) {
    return sendError(res, 404, "Fight not found");
  }

  const { status, winnerId, method } = req.body;

  const allowedStatuses = ["scheduled", "finished", "draw", "no_contest", "cancelled"];

  if (!allowedStatuses.includes(status)) {
    return sendError(res, 400, "Invalid status");
  }

  if (status === "finished") {
    if (winnerId == null) {
      return sendError(
        res,
        400,
        "winnerId is required when status is finished"
      );
    }

    if (method !== "decision" && method !== "finish") {
      return sendError(
        res,
        400,
        "method is required when status is finished"
      );
    }

    if (winnerId !== fight.fighter1Id && winnerId !== fight.fighter2Id) {
      return sendError(
        res,
        400,
        "winnerId must be either fighter1Id or fighter2Id"
      );
    }
  }

  if(
    status === "scheduled" ||
    status === "draw" ||
    status === "no_contest" ||
    status === "cancelled"
  ) {
    if (winnerId !== null) {
      return sendError(
        res,
        400,
        "winnerId must be null when status is not finished"
      );
    }
    
    if (method !== null) {
      return sendError(
        res,
        400,
        "method must be null when status is not finished"
      );
    }
  }

  const updatedFight = await prisma.fight.update({
    where: {
      id: fightId,
    },
    data: {
      status,
      winnerId: winnerId ?? null,
      method: method ?? null,
    },
  });

  return res.status(200).json({
    success: true,
    message: "Fight result updated",
    fight: updatedFight,
  });
});


export default app;