import { PrismaClient } from "@prisma/client";
import * as readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input,
  output,
});

const nodeEnv = process.env.NODE_ENV ?? "development";

const JST_OFFSET = "+09:00";
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})[ ](\d{2}):(\d{2})$/;

const getSafeDatabaseTarget = (): string => {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return "NOT SET";
  }

  if (databaseUrl.startsWith("file:")) {
    return `SQLite (${databaseUrl.slice("file:".length)})`;
  }

  try {
    const url = new URL(databaseUrl);

    return `${url.protocol}//${url.hostname}${
      url.port ? `:${url.port}` : ""
    }${url.pathname}`;
  } catch {
    return "Configured (details hidden)";
  }
};

const parseJstDateTime = (value: string): Date | null => {
  const trimmed = value.trim();
  const match = DATE_TIME_PATTERN.exec(trimmed);

  if (!match) {
    return null;
  }

  const [, yearText, monthText, dayText, hourText, minuteText] =
    match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59
  ) {
    return null;
  }

  const date = new Date(
    `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}:00${JST_OFFSET}`
  );

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  // 2026-02-31のような日付をDateの自動補正で受理しない。
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  if (
    Number(part("year")) !== year ||
    Number(part("month")) !== month ||
    Number(part("day")) !== day ||
    Number(part("hour")) !== hour ||
    Number(part("minute")) !== minute
  ) {
    return null;
  }

  return date;
};

const formatJstDateTime = (date: Date): string => {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((item) => item.type === type)?.value ?? "";

  return `${part("year")}-${part("month")}-${part("day")} ${part(
    "hour"
  )}:${part("minute")} JST`;
};

const askYesNo = async (message: string): Promise<boolean> => {
  const answer = (await rl.question(`${message} (y/N): `))
    .trim()
    .toLowerCase();

  return answer === "y";
};

const confirmWrite = async (): Promise<boolean> => {
  if (nodeEnv === "production") {
    const answer = await rl.question(
      'Type "CONFIRM" to execute: '
    );

    if (answer !== "CONFIRM") {
      console.log("Confirmation failed. No database changes were made.");
      return false;
    }

    return true;
  }

  const confirmed = await askYesNo("Execute this database change?");

  if (!confirmed) {
    console.log("Cancelled. No database changes were made.");
    return false;
  }

  return true;
};

const requireProductionStartupConfirmation =
  async (): Promise<boolean> => {
    if (nodeEnv !== "production") {
      return true;
    }

    console.log("");
    console.log("========================================");
    console.log("WARNING: PRODUCTION DATABASE OPERATIONS");
    console.log("========================================");

    const answer = await rl.question(
      'Type "PRODUCTION" to continue: '
    );

    if (answer !== "PRODUCTION") {
      console.log("Production confirmation failed. Exiting.");
      return false;
    }

    return true;
  };

const createEvent = async (): Promise<void> => {
  console.log("");
  console.log("Create Event");
  console.log("Datetime format: YYYY-MM-DD HH:mm (JST)");

  const name = (await rl.question("Name: ")).trim();

  if (!name) {
    console.log("Error: name must not be empty.");
    return;
  }

  const dateInput = await rl.question(
    "Event date (YYYY-MM-DD HH:mm JST): "
  );
  const date = parseJstDateTime(dateInput);

  if (!date) {
    console.log("Error: invalid event date.");
    return;
  }

  const deadlineInput = await rl.question(
    "Prediction deadline (YYYY-MM-DD HH:mm JST): "
  );
  const deadline = parseJstDateTime(deadlineInput);

  if (!deadline) {
    console.log("Error: invalid prediction deadline.");
    return;
  }

  if (deadline >= date) {
    console.log(
      "Error: prediction deadline must be earlier than event date."
    );
    return;
  }

  console.log("");
  console.log("Operation: Event Create");
  console.log("Target: New Event");
  console.log("Current value: (none)");
  console.log("New value:");
  console.log(`  name: ${name}`);
  console.log(`  date: ${formatJstDateTime(date)}`);
  console.log(`  deadline: ${formatJstDateTime(deadline)}`);

  if (!(await confirmWrite())) {
    return;
  }

  try {
    const event = await prisma.event.create({
      data: {
        name,
        date,
        deadline,
      },
    });

    console.log(`Event created successfully. ID: ${event.id}`);
  } catch (error) {
    console.log("Error: failed to create Event.");

    if (nodeEnv !== "production" && error instanceof Error) {
      console.log(error.message);
    }
  }
};

const editEvent = async (): Promise<void> => {
  console.log("");
  console.log("Edit Event");

  const idInput = (await rl.question("Event ID: ")).trim();
  const eventId = Number(idInput);

  if (
    !Number.isInteger(eventId) ||
    eventId <= 0 ||
    String(eventId) !== idInput
  ) {
    console.log("Error: invalid Event ID.");
    return;
  }

  const event = await prisma.event.findUnique({
    where: {
      id: eventId,
    },
  });

  if (!event) {
    console.log("Error: Event not found.");
    return;
  }

  const now = new Date();
  const deadlinePassed = now >= event.deadline;
  const eventStarted = now >= event.date;

  console.log("");
  console.log("Current Event:");
  console.log(`  id: ${event.id}`);
  console.log(`  name: ${event.name}`);
  console.log(`  date: ${formatJstDateTime(event.date)}`);
  console.log(
    `  deadline: ${formatJstDateTime(event.deadline)}`
  );

  if (deadlinePassed) {
    console.log("");
    console.log("!!! PREDICTION DEADLINE HAS PASSED !!!");
    console.log(
      "Deadline cannot be changed by the normal admin CLI."
    );
  }

  if (eventStarted) {
    console.log("");
    console.log("!!! EVENT HAS ALREADY STARTED !!!");
  }

  console.log("");
  console.log(
    "Enter a new value, or press Enter to keep the current value."
  );
  console.log("Datetime format: YYYY-MM-DD HH:mm (JST)");

  const nameInput = await rl.question(
    `Name [${event.name}]: `
  );
  const newName =
    nameInput.length === 0 ? event.name : nameInput.trim();

  if (!newName) {
    console.log("Error: name must not be empty.");
    return;
  }

  const dateInput = await rl.question(
    `Event date [${formatJstDateTime(event.date)}]: `
  );

  let newDate = event.date;

  if (dateInput.trim() !== "") {
    const parsedDate = parseJstDateTime(dateInput);

    if (!parsedDate) {
      console.log("Error: invalid event date.");
      return;
    }

    newDate = parsedDate;
  }

  let newDeadline = event.deadline;

  if (deadlinePassed) {
    console.log(
      "Prediction deadline: unchanged (deadline has already passed)"
    );
  } else {
    const deadlineInput = await rl.question(
      `Prediction deadline [${formatJstDateTime(
        event.deadline
      )}]: `
    );

    if (deadlineInput.trim() !== "") {
      const parsedDeadline = parseJstDateTime(deadlineInput);

      if (!parsedDeadline) {
        console.log("Error: invalid prediction deadline.");
        return;
      }

      newDeadline = parsedDeadline;
    }
  }

  if (newDeadline >= newDate) {
    console.log(
      "Error: prediction deadline must be earlier than event date."
    );
    return;
  }

  if (!deadlinePassed && newDeadline <= now) {
    console.log(
      "Error: new prediction deadline must be in the future."
    );
    return;
  }

  const changed =
    newName !== event.name ||
    newDate.getTime() !== event.date.getTime() ||
    newDeadline.getTime() !== event.deadline.getTime();

  if (!changed) {
    console.log("No changes.");
    return;
  }

  console.log("");
  console.log("Operation: Event Edit");
  console.log(`Target: Event ${event.id}`);
  console.log("Current value:");
  console.log(`  name: ${event.name}`);
  console.log(`  date: ${formatJstDateTime(event.date)}`);
  console.log(
    `  deadline: ${formatJstDateTime(event.deadline)}`
  );
  console.log("New value:");
  console.log(`  name: ${newName}`);
  console.log(`  date: ${formatJstDateTime(newDate)}`);
  console.log(
    `  deadline: ${formatJstDateTime(newDeadline)}`
  );

  if (!(await confirmWrite())) {
    return;
  }

  try {
    await prisma.event.update({
      where: {
        id: event.id,
      },
      data: {
        name: newName,
        date: newDate,
        deadline: newDeadline,
      },
    });

    console.log("Event updated successfully.");
  } catch (error) {
    console.log("Error: failed to update Event.");

    if (nodeEnv !== "production" && error instanceof Error) {
      console.log(error.message);
    }
  }
};

const showEventMenu = async (): Promise<void> => {
  while (true) {
    console.log("");
    console.log("Event Management");
    console.log("");
    console.log("1. Create Event");
    console.log("2. Edit Event");
    console.log("3. Back");
    console.log("");

    const choice = (await rl.question("Select: ")).trim();

    switch (choice) {
      case "1":
        await createEvent();
        break;

      case "2":
        await editEvent();
        break;

      case "3":
        return;

      default:
        console.log("Invalid selection.");
        break;
    }
  }
};

const showDuplicateFighters = async (
  name: string,
  excludeId?: number
): Promise<void> => {
  const duplicates = await prisma.fighter.findMany({
    where: {
      name,
      ...(excludeId !== undefined
        ? {
            id: {
              not: excludeId,
            },
          }
        : {}),
    },
    orderBy: {
      id: "asc",
    },
  });

  if (duplicates.length === 0) {
    return;
  }

  console.log("");
  console.log("!!! DUPLICATE FIGHTER NAME WARNING !!!");
  console.log("Existing Fighter(s):");

  for (const fighter of duplicates) {
    console.log(`  id: ${fighter.id}, name: ${fighter.name}`);
  }

  console.log(
    "The same name is allowed because different people may share a name."
  );
};

const createFighter = async (): Promise<void> => {
  console.log("");
  console.log("Create Fighter");

  const name = (await rl.question("Name: ")).trim();

  if (!name) {
    console.log("Error: name must not be empty.");
    return;
  }

  try {
    await showDuplicateFighters(name);

    console.log("");
    console.log("Operation: Fighter Create");
    console.log("Target: New Fighter");
    console.log("Current value: (none)");
    console.log("New value:");
    console.log(`  name: ${name}`);

    if (!(await confirmWrite())) {
      return;
    }

    const fighter = await prisma.fighter.create({
      data: {
        name,
      },
    });

    console.log(`Fighter created successfully. ID: ${fighter.id}`);
  } catch (error) {
    console.log("Error: failed to create Fighter.");

    if (nodeEnv !== "production" && error instanceof Error) {
      console.log(error.message);
    }
  }
};

const editFighter = async (): Promise<void> => {
  console.log("");
  console.log("Edit Fighter");

  const idInput = (await rl.question("Fighter ID: ")).trim();
  const fighterId = Number(idInput);

  if (
    !Number.isInteger(fighterId) ||
    fighterId <= 0 ||
    String(fighterId) !== idInput
  ) {
    console.log("Error: invalid Fighter ID.");
    return;
  }

  let fighter;

  try {
    fighter = await prisma.fighter.findUnique({
      where: {
        id: fighterId,
      },
    });
  } catch (error) {
    console.log("Error: failed to load Fighter.");

    if (nodeEnv !== "production" && error instanceof Error) {
      console.log(error.message);
    }

    return;
  }

  if (!fighter) {
    console.log("Error: Fighter not found.");
    return;
  }

  console.log("");
  console.log("Current Fighter:");
  console.log(`  id: ${fighter.id}`);
  console.log(`  name: ${fighter.name}`);
  console.log("");
  console.log(
    "Fighter Edit is intended for typo or notation corrections."
  );
  console.log(
    "Do not use it to replace this Fighter with a different person."
  );

  const nameInput = await rl.question(
    `Name [${fighter.name}]: `
  );

  const newName =
    nameInput.length === 0 ? fighter.name : nameInput.trim();

  if (!newName) {
    console.log("Error: name must not be empty.");
    return;
  }

  if (newName === fighter.name) {
    console.log("No changes.");
    return;
  }

  try {
    await showDuplicateFighters(newName, fighter.id);

    console.log("");
    console.log("Operation: Fighter Edit");
    console.log(`Target: Fighter ${fighter.id}`);
    console.log("Current value:");
    console.log(`  name: ${fighter.name}`);
    console.log("New value:");
    console.log(`  name: ${newName}`);

    if (!(await confirmWrite())) {
      return;
    }

    await prisma.fighter.update({
      where: {
        id: fighter.id,
      },
      data: {
        name: newName,
      },
    });

    console.log("Fighter updated successfully.");
  } catch (error) {
    console.log("Error: failed to update Fighter.");

    if (nodeEnv !== "production" && error instanceof Error) {
      console.log(error.message);
    }
  }
};

const showFighterMenu = async (): Promise<void> => {
  while (true) {
    console.log("");
    console.log("Fighter Management");
    console.log("");
    console.log("1. Create Fighter");
    console.log("2. Edit Fighter");
    console.log("3. Back");
    console.log("");

    const choice = (await rl.question("Select: ")).trim();

    switch (choice) {
      case "1":
        await createFighter();
        break;

      case "2":
        await editFighter();
        break;

      case "3":
        return;

      default:
        console.log("Invalid selection.");
        break;
    }
  }
};



const parsePositiveInteger = (value: string): number | null => {
  const trimmed = value.trim();
  const parsed = Number(trimmed);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0 ||
    String(parsed) !== trimmed
  ) {
    return null;
  }

  return parsed;
};

const formatFighter = (fighter: { id: number; name: string } | null): string =>
  fighter ? `${fighter.id} (${fighter.name})` : "TBD (null)";

const loadFightDetails = async (fightId: number) => {
  const fight = await prisma.fight.findUnique({
    where: { id: fightId },
  });

  if (!fight) {
    return null;
  }

  const [event, fighter1, fighter2, predictionCount] = await Promise.all([
    prisma.event.findUnique({ where: { id: fight.eventId } }),
    prisma.fighter.findUnique({ where: { id: fight.fighter1Id } }),
    fight.fighter2Id === null
      ? Promise.resolve(null)
      : prisma.fighter.findUnique({ where: { id: fight.fighter2Id } }),
    prisma.prediction.count({ where: { fightId: fight.id } }),
  ]);

  if (!event || !fighter1 || (fight.fighter2Id !== null && !fighter2)) {
    throw new Error("Fight references invalid Event or Fighter data.");
  }

  return { fight, event, fighter1, fighter2, predictionCount };
};

const createFight = async (): Promise<void> => {
  console.log("");
  console.log("Create Fight");

  const eventIdInput = (await rl.question("Event ID: ")).trim();
  const eventId = parsePositiveInteger(eventIdInput);

  if (eventId === null) {
    console.log("Error: invalid Event ID.");
    return;
  }

  const event = await prisma.event.findUnique({ where: { id: eventId } });

  if (!event) {
    console.log("Error: Event not found.");
    return;
  }

  console.log("");
  console.log("Selected Event:");
  console.log(`  id: ${event.id}`);
  console.log(`  name: ${event.name}`);
  console.log(`  date: ${formatJstDateTime(event.date)}`);
  console.log(`  deadline: ${formatJstDateTime(event.deadline)}`);

  const now = new Date();
  if (now >= event.deadline) {
    console.log("");
    console.log("!!! PREDICTION DEADLINE HAS PASSED !!!");
  }
  if (now >= event.date) {
    console.log("");
    console.log("!!! EVENT HAS ALREADY STARTED !!!");
  }

  const fighter1IdInput = (await rl.question("fighter1 ID: ")).trim();
  const fighter1Id = parsePositiveInteger(fighter1IdInput);
  if (fighter1Id === null) {
    console.log("Error: invalid fighter1 ID.");
    return;
  }

  const fighter1 = await prisma.fighter.findUnique({ where: { id: fighter1Id } });
  if (!fighter1) {
    console.log("Error: fighter1 not found.");
    return;
  }
  console.log(`Selected fighter1: ${formatFighter(fighter1)}`);

  const fighter2IdInput = (
    await rl.question("fighter2 ID (press Enter for TBD): ")
  ).trim();
  let fighter2: { id: number; name: string } | null = null;

  if (fighter2IdInput !== "") {
    const fighter2Id = parsePositiveInteger(fighter2IdInput);
    if (fighter2Id === null) {
      console.log("Error: invalid fighter2 ID.");
      return;
    }
    if (fighter2Id === fighter1.id) {
      console.log("Error: fighter1 and fighter2 must be different.");
      return;
    }
    fighter2 = await prisma.fighter.findUnique({ where: { id: fighter2Id } });
    if (!fighter2) {
      console.log("Error: fighter2 not found.");
      return;
    }
    console.log(`Selected fighter2: ${formatFighter(fighter2)}`);
  } else {
    console.log("Selected fighter2: TBD (null)");
  }

  const fightOrderInput = (await rl.question("fightOrder: ")).trim();
  const fightOrder = parsePositiveInteger(fightOrderInput);
  if (fightOrder === null) {
    console.log("Error: fightOrder must be an integer of 1 or greater.");
    return;
  }

  const duplicateFight = await prisma.fight.findFirst({
    where: { eventId: event.id, fightOrder },
  });
  if (duplicateFight) {
    console.log("Error: fightOrder is already used in this Event.");
    console.log(
      `Existing Fight: id=${duplicateFight.id}, status=${duplicateFight.status}, fightOrder=${duplicateFight.fightOrder}`
    );
    return;
  }

  console.log("");
  console.log("Operation: Fight Create");
  console.log("Target: New Fight");
  console.log("Current value: (none)");
  console.log("New value:");
  console.log(`  Event: ${event.id} (${event.name})`);
  console.log(`  fighter1: ${formatFighter(fighter1)}`);
  console.log(`  fighter2: ${formatFighter(fighter2)}`);
  console.log(`  fightOrder: ${fightOrder}`);
  console.log("  status: scheduled");
  console.log("  winnerId: null");
  console.log("  method: null");

  if (!(await confirmWrite())) return;

  try {
    const fight = await prisma.fight.create({
      data: {
        eventId: event.id,
        fighter1Id: fighter1.id,
        fighter2Id: fighter2?.id ?? null,
        fightOrder,
        status: "scheduled",
        winnerId: null,
        method: null,
      },
    });
    console.log(`Fight created successfully. ID: ${fight.id}`);
  } catch (error) {
    console.log("Error: failed to create Fight.");
    if (nodeEnv !== "production" && error instanceof Error) console.log(error.message);
  }
};

const editFight = async (): Promise<void> => {
  console.log("");
  console.log("Edit Fight");

  const fightIdInput = (await rl.question("Fight ID: ")).trim();
  const fightId = parsePositiveInteger(fightIdInput);
  if (fightId === null) {
    console.log("Error: invalid Fight ID.");
    return;
  }

  let details;
  try {
    details = await loadFightDetails(fightId);
  } catch (error) {
    console.log("Error: failed to load Fight details.");
    if (nodeEnv !== "production" && error instanceof Error) console.log(error.message);
    return;
  }
  if (!details) {
    console.log("Error: Fight not found.");
    return;
  }

  const { fight, event, fighter1, fighter2, predictionCount } = details;
  console.log("");
  console.log("Current Fight:");
  console.log(`  id: ${fight.id}`);
  console.log(`  Event: ${event.id} (${event.name})`);
  console.log(`  fighter1: ${formatFighter(fighter1)}`);
  console.log(`  fighter2: ${formatFighter(fighter2)}`);
  console.log(`  fightOrder: ${fight.fightOrder ?? "null"}`);
  console.log(`  status: ${fight.status}`);
  console.log(`  Prediction count: ${predictionCount}`);

  if (predictionCount > 0) {
    console.log("");
    console.log("Fight cannot be edited because Predictions already exist.");
    console.log("Use Replace card in Phase 3-C instead of changing the Fighters directly.");
    return;
  }

  console.log("");
  console.log("Enter a new value, or press Enter to keep the current value.");
  const fighter1Input = (await rl.question(`fighter1 ID [${fighter1.id}]: `)).trim();
  let newFighter1 = fighter1;
  if (fighter1Input !== "") {
    const id = parsePositiveInteger(fighter1Input);
    if (id === null) {
      console.log("Error: invalid fighter1 ID.");
      return;
    }
    const selected = await prisma.fighter.findUnique({ where: { id } });
    if (!selected) {
      console.log("Error: fighter1 not found.");
      return;
    }
    newFighter1 = selected;
    console.log(`Selected fighter1: ${formatFighter(selected)}`);
  }

  const fighter2Prompt = fighter2
    ? `fighter2 ID [${fighter2.id}] (Enter=keep, NULL=unset): `
    : "fighter2 ID [TBD] (Enter=keep, ID=set): ";
  const fighter2Input = (await rl.question(fighter2Prompt)).trim();
  let newFighter2 = fighter2;
  if (fighter2Input.toUpperCase() === "NULL") {
    newFighter2 = null;
  } else if (fighter2Input !== "") {
    const id = parsePositiveInteger(fighter2Input);
    if (id === null) {
      console.log("Error: invalid fighter2 ID.");
      return;
    }
    const selected = await prisma.fighter.findUnique({ where: { id } });
    if (!selected) {
      console.log("Error: fighter2 not found.");
      return;
    }
    newFighter2 = selected;
    console.log(`Selected fighter2: ${formatFighter(selected)}`);
  }

  if (newFighter2 && newFighter1.id === newFighter2.id) {
    console.log("Error: fighter1 and fighter2 must be different.");
    return;
  }

  if (
    newFighter1.id === fight.fighter1Id &&
    (newFighter2?.id ?? null) === fight.fighter2Id
  ) {
    console.log("No changes.");
    return;
  }

  console.log("");
  console.log("Operation: Fight Edit");
  console.log(`Target: Fight ${fight.id}`);
  console.log("Current value:");
  console.log(`  fighter1: ${formatFighter(fighter1)}`);
  console.log(`  fighter2: ${formatFighter(fighter2)}`);
  console.log("New value:");
  console.log(`  fighter1: ${formatFighter(newFighter1)}`);
  console.log(`  fighter2: ${formatFighter(newFighter2)}`);

  if (!(await confirmWrite())) return;

  try {
    await prisma.$transaction(async (tx) => {
      const latestPredictionCount = await tx.prediction.count({ where: { fightId: fight.id } });
      if (latestPredictionCount > 0) {
        throw new Error("PREDICTIONS_EXIST");
      }
      await tx.fight.update({
        where: { id: fight.id },
        data: {
          fighter1Id: newFighter1.id,
          fighter2Id: newFighter2?.id ?? null,
        },
      });
    });
    console.log("Fight updated successfully.");
  } catch (error) {
    if (error instanceof Error && error.message === "PREDICTIONS_EXIST") {
      console.log("Update cancelled: a Prediction was added before the write completed.");
      console.log("No Fight changes were made.");
      return;
    }
    console.log("Error: failed to update Fight.");
    if (nodeEnv !== "production" && error instanceof Error) console.log(error.message);
  }
};

const cancelFight = async (): Promise<void> => {
  console.log("");
  console.log("Cancel Fight");

  const fightIdInput = (await rl.question("Fight ID: ")).trim();
  const fightId = parsePositiveInteger(fightIdInput);
  if (fightId === null) {
    console.log("Error: invalid Fight ID.");
    return;
  }

  let details;
  try {
    details = await loadFightDetails(fightId);
  } catch (error) {
    console.log("Error: failed to load Fight details.");
    if (nodeEnv !== "production" && error instanceof Error) console.log(error.message);
    return;
  }
  if (!details) {
    console.log("Error: Fight not found.");
    return;
  }

  const { fight, event, fighter1, fighter2, predictionCount } = details;
  console.log("");
  console.log("Current Fight:");
  console.log(`  id: ${fight.id}`);
  console.log(`  Event: ${event.id} (${event.name})`);
  console.log(`  fighter1: ${formatFighter(fighter1)}`);
  console.log(`  fighter2: ${formatFighter(fighter2)}`);
  console.log(`  fightOrder: ${fight.fightOrder ?? "null"}`);
  console.log(`  status: ${fight.status}`);
  console.log(`  Prediction count: ${predictionCount}`);

  if (fight.status === "cancelled") {
    console.log("Fight is already cancelled. No changes.");
    return;
  }

  if (fight.status !== "scheduled") {
    console.log("");
    console.log("!!! CONFIRMED FIGHT RESULT WILL BE OVERRIDDEN !!!");
    console.log(`Current status: ${fight.status}`);
    console.log("New status: cancelled");
    const confirmed = await askYesNo(
      "Are you sure you want to cancel this already-settled Fight?"
    );
    if (!confirmed) {
      console.log("Cancelled. No database changes were made.");
      return;
    }
  }

  console.log("");
  console.log("Operation: Fight Cancel");
  console.log(`Target: Fight ${fight.id}`);
  console.log("Current value:");
  console.log(`  status: ${fight.status}`);
  console.log(`  winnerId: ${fight.winnerId ?? "null"}`);
  console.log(`  method: ${fight.method ?? "null"}`);
  console.log(`  fightOrder: ${fight.fightOrder ?? "null"}`);
  console.log("New value:");
  console.log("  status: cancelled");
  console.log("  cancelReason: STANDARD");
  console.log("  winnerId: null");
  console.log("  method: null");
  console.log(`  fightOrder: ${fight.fightOrder ?? "null"} (unchanged)`);

  if (!(await confirmWrite())) return;

  try {
    await prisma.fight.update({
      where: { id: fight.id },
      data: {
        status: "cancelled",
        cancelReason: "STANDARD",
        winnerId: null,
        method: null,
      },
    });
    console.log("Fight cancelled successfully.");
  } catch (error) {
    console.log("Error: failed to cancel Fight.");
    if (nodeEnv !== "production" && error instanceof Error) console.log(error.message);
  }
};

const replaceFight = async (): Promise<void> => {
  console.log("");
  console.log("Replace card");

  const fightIdInput = (await rl.question("Fight ID: ")).trim();
  const fightId = parsePositiveInteger(fightIdInput);

  if (fightId === null) {
    console.log("Error: invalid Fight ID.");
    return;
  }

  let details;
  try {
    details = await loadFightDetails(fightId);
  } catch (error) {
    console.log("Error: failed to load Fight details.");
    if (nodeEnv !== "production" && error instanceof Error) {
      console.log(error.message);
    }
    return;
  }

  if (!details) {
    console.log("Error: Fight not found.");
    return;
  }

  const { fight, event, fighter1, fighter2, predictionCount } = details;

  if (fight.status !== "scheduled") {
    console.log(
      `Error: only scheduled Fight can be replaced. Current status: ${fight.status}`
    );
    return;
  }

  if (fight.fightOrder === null) {
    console.log("Error: Fight with fightOrder=null cannot be replaced.");
    return;
  }

  const fighter1IdInput = (await rl.question("New fighter1 ID: ")).trim();
  const newFighter1Id = parsePositiveInteger(fighter1IdInput);

  if (newFighter1Id === null) {
    console.log("Error: invalid fighter1 ID.");
    return;
  }

  const newFighter1 = await prisma.fighter.findUnique({
    where: { id: newFighter1Id },
  });

  if (!newFighter1) {
    console.log("Error: fighter1 not found.");
    return;
  }

  const fighter2IdInput = (
    await rl.question("New fighter2 ID (press Enter for TBD): ")
  ).trim();

  let newFighter2: { id: number; name: string } | null = null;

  if (fighter2IdInput !== "") {
    const newFighter2Id = parsePositiveInteger(fighter2IdInput);

    if (newFighter2Id === null) {
      console.log("Error: invalid fighter2 ID.");
      return;
    }

    if (newFighter2Id === newFighter1.id) {
      console.log("Error: fighter1 and fighter2 must be different.");
      return;
    }

    newFighter2 = await prisma.fighter.findUnique({
      where: { id: newFighter2Id },
    });

    if (!newFighter2) {
      console.log("Error: fighter2 not found.");
      return;
    }
  }

  if (
    newFighter1.id === fight.fighter1Id &&
    (newFighter2?.id ?? null) === fight.fighter2Id
  ) {
    console.log("Error: new card is identical to the current card.");
    return;
  }

  const predictionPointAggregate = await prisma.prediction.aggregate({
    where: { fightId: fight.id },
    _sum: { point: true },
  });

  const allocatedPointTotal = predictionPointAggregate._sum.point ?? 0;
  const previewNow = new Date();
  const previewIsBeforeDeadline = previewNow < event.deadline;
  const eventAlreadyStarted = previewNow >= event.date;

  console.log("");
  console.log("========================================");
  console.log("Replace card confirmation");
  console.log("========================================");
  console.log("");
  console.log("Environment");
  console.log(`- NODE_ENV: ${nodeEnv}`);
  console.log(`- Database: ${getSafeDatabaseTarget()}`);

  console.log("");
  console.log("Event");
  console.log(`- ID: ${event.id}`);
  console.log(`- name: ${event.name}`);
  console.log(`- Event Start: ${formatJstDateTime(event.date)}`);
  console.log(
    `- Prediction Deadline: ${formatJstDateTime(event.deadline)}`
  );
  console.log(
    `- Deadline Status: ${
      previewIsBeforeDeadline ? "BEFORE DEADLINE" : "AFTER DEADLINE"
    }`
  );
  console.log("  (Reference only. Final status is decided in transaction.)");

  console.log("");
  console.log("Current Fight");
  console.log(`- ID: ${fight.id}`);
  console.log(`- fightOrder: ${fight.fightOrder}`);
  console.log(`- fighter1: ${formatFighter(fighter1)}`);
  console.log(`- fighter2: ${formatFighter(fighter2)}`);
  console.log(`- status: ${fight.status}`);
  console.log(`- Prediction count: ${predictionCount}`);
  console.log(`- Prediction allocated point total: ${allocatedPointTotal}`);

  console.log("");
  console.log("New Fight");
  console.log(`- fighter1: ${formatFighter(newFighter1)}`);
  console.log(`- fighter2: ${formatFighter(newFighter2)}`);
  console.log(`- fightOrder: ${fight.fightOrder}`);

  console.log("");
  console.log("REPLACE RESULT");
  console.log("");

  if (previewIsBeforeDeadline) {
    console.log("Old Fight:");
    console.log("-> CANCELLED");
    console.log("-> REPLACED_BEFORE_DEADLINE");
    console.log("-> Existing Predictions = VOID");
    console.log("-> Allocated points will be released.");
    console.log("");
    console.log("New Fight:");
    console.log("-> New Fight ID will be created");
    console.log("-> Prediction available until Event deadline.");
  } else {
    console.log("Old Fight:");
    console.log("-> CANCELLED");
    console.log("-> REPLACED_AFTER_DEADLINE");
    console.log("-> Existing Predictions = REFUND");
    console.log("");
    console.log("New Fight:");
    console.log("-> New Fight ID will be created");
    console.log("-> Prediction is NOT available.");
    console.log("-> Event deadline will NOT be reopened.");
  }

  let eventStartedConfirmed = false;

  if (eventAlreadyStarted) {
    console.log("");
    console.log("========================================");
    console.log("WARNING:");
    console.log("EVENT HAS ALREADY STARTED.");
    console.log("");
    console.log(
      "Replace is allowed only if the target fight has NOT started."
    );
    console.log("Confirm that the fight has not started.");
    console.log("========================================");

    const startedAnswer = await rl.question(
      'Type "FIGHT_NOT_STARTED" to continue: '
    );

    if (startedAnswer !== "FIGHT_NOT_STARTED") {
      console.log("Confirmation failed. No database changes were made.");
      return;
    }

    eventStartedConfirmed = true;
  }

  console.log("");
  const confirmation = await rl.question('Type "CONFIRM" to execute: ');

  if (confirmation !== "CONFIRM") {
    console.log("Confirmation failed. No database changes were made.");
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const latestFight = await tx.fight.findUnique({
        where: { id: fight.id },
      });

      if (!latestFight) {
        throw new Error("REPLACE_FIGHT_NOT_FOUND");
      }

      const latestEvent = await tx.event.findUnique({
        where: { id: latestFight.eventId },
      });

      if (!latestEvent) {
        throw new Error("REPLACE_EVENT_NOT_FOUND");
      }

      if (latestFight.status !== "scheduled") {
        throw new Error("REPLACE_FIGHT_NOT_SCHEDULED");
      }

      if (latestFight.fightOrder === null) {
        throw new Error("REPLACE_FIGHT_ORDER_NULL");
      }

      const latestNewFighter1 = await tx.fighter.findUnique({
        where: { id: newFighter1.id },
      });

      if (!latestNewFighter1) {
        throw new Error("REPLACE_FIGHTER1_NOT_FOUND");
      }

      let latestNewFighter2: { id: number; name: string } | null = null;

      if (newFighter2 !== null) {
        latestNewFighter2 = await tx.fighter.findUnique({
          where: { id: newFighter2.id },
        });

        if (!latestNewFighter2) {
          throw new Error("REPLACE_FIGHTER2_NOT_FOUND");
        }
      }

      if (
        latestNewFighter2 !== null &&
        latestNewFighter1.id === latestNewFighter2.id
      ) {
        throw new Error("REPLACE_SAME_FIGHTER");
      }

      if (
        latestNewFighter1.id === latestFight.fighter1Id &&
        (latestNewFighter2?.id ?? null) === latestFight.fighter2Id
      ) {
        throw new Error("REPLACE_IDENTICAL_CARD");
      }

      const transactionNow = new Date();

      if (
        transactionNow >= latestEvent.date &&
        !eventStartedConfirmed
      ) {
        throw new Error("REPLACE_EVENT_STARTED_CONFIRMATION_REQUIRED");
      }

      const cancelReason =
        transactionNow < latestEvent.deadline
          ? "REPLACED_BEFORE_DEADLINE"
          : "REPLACED_AFTER_DEADLINE";

      const inheritedFightOrder = latestFight.fightOrder;

      await tx.fight.update({
        where: { id: latestFight.id },
        data: {
          status: "cancelled",
          cancelReason,
          fightOrder: null,
          winnerId: null,
          method: null,
        },
      });

      const newFight = await tx.fight.create({
        data: {
          eventId: latestFight.eventId,
          fighter1Id: latestNewFighter1.id,
          fighter2Id: latestNewFighter2?.id ?? null,
          fightOrder: inheritedFightOrder,
          status: "scheduled",
          cancelReason: null,
          winnerId: null,
          method: null,
        },
      });

      return {
        oldFightId: latestFight.id,
        newFightId: newFight.id,
        fightOrder: inheritedFightOrder,
        cancelReason,
      };
    });

    console.log("");
    console.log("Fight replaced successfully.");
    console.log(`Old Fight ID: ${result.oldFightId}`);
    console.log(`New Fight ID: ${result.newFightId}`);
    console.log(`fightOrder: ${result.fightOrder}`);
    console.log(`cancelReason: ${result.cancelReason}`);
  } catch (error) {
    console.log("");
    console.log("Replace failed. No Fight changes were committed.");

    if (error instanceof Error) {
      switch (error.message) {
        case "REPLACE_FIGHT_NOT_FOUND":
          console.log("Reason: target Fight no longer exists.");
          break;
        case "REPLACE_EVENT_NOT_FOUND":
          console.log("Reason: Event no longer exists.");
          break;
        case "REPLACE_FIGHT_NOT_SCHEDULED":
          console.log(
            "Reason: target Fight is no longer scheduled."
          );
          break;
        case "REPLACE_FIGHT_ORDER_NULL":
          console.log("Reason: target Fight now has fightOrder=null.");
          break;
        case "REPLACE_FIGHTER1_NOT_FOUND":
          console.log("Reason: new fighter1 no longer exists.");
          break;
        case "REPLACE_FIGHTER2_NOT_FOUND":
          console.log("Reason: new fighter2 no longer exists.");
          break;
        case "REPLACE_SAME_FIGHTER":
          console.log(
            "Reason: fighter1 and fighter2 must be different."
          );
          break;
        case "REPLACE_IDENTICAL_CARD":
          console.log(
            "Reason: new card is identical to the current card."
          );
          break;
        case "REPLACE_EVENT_STARTED_CONFIRMATION_REQUIRED":
          console.log(
            "Reason: Event started after the confirmation screen was displayed."
          );
          console.log(
            "Run Replace card again and explicitly confirm that the target fight has not started."
          );
          break;
        default:
          console.log("Reason: transaction failed.");
          if (nodeEnv !== "production") {
            console.log(error.message);
          }
          break;
      }
    }
  }
};

const reorderFights = async (): Promise<void> => {
  console.log("");
  console.log("Reorder fights");

  const eventIdInput = (await rl.question("Event ID: ")).trim();
  const eventId = parsePositiveInteger(eventIdInput);

  if (eventId === null) {
    console.log("Error: invalid Event ID.");
    return;
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
  });

  if (!event) {
    console.log("Error: Event not found.");
    return;
  }

  const currentFights = await prisma.fight.findMany({
    where: {
      eventId,
      fightOrder: { not: null },
    },
    orderBy: [
      { fightOrder: "asc" },
      { id: "asc" },
    ],
  });

  if (currentFights.length === 0) {
    console.log("Error: no ordered Fights found for this Event.");
    return;
  }

  const fighterIds = Array.from(
    new Set(
      currentFights.flatMap((fight) =>
        fight.fighter2Id === null
          ? [fight.fighter1Id]
          : [fight.fighter1Id, fight.fighter2Id]
      )
    )
  );

  const fighters = await prisma.fighter.findMany({
    where: {
      id: { in: fighterIds },
    },
  });

  const fighterNameById = new Map(
    fighters.map((fighter) => [fighter.id, fighter.name])
  );

  const formatFightCard = (fight: (typeof currentFights)[number]): string => {
    const fighter1Name =
      fighterNameById.get(fight.fighter1Id) ?? `Unknown (${fight.fighter1Id})`;

    const fighter2Name =
      fight.fighter2Id === null
        ? "TBD"
        : fighterNameById.get(fight.fighter2Id) ??
          `Unknown (${fight.fighter2Id})`;

    return `${fighter1Name} vs ${fighter2Name}`;
  };

  console.log("");
  console.log("Current Card");
  console.log("");

  for (const fight of currentFights) {
    console.log(
      `${fight.fightOrder} | Fight ID ${fight.id} | ${formatFightCard(
        fight
      )} | ${fight.status}`
    );
  }

  console.log("");
  console.log(
    "Enter ALL Fight IDs in the desired order, separated by commas."
  );

  const orderInput = (
    await rl.question("New order (example: 104,101,103,102): ")
  ).trim();

  if (orderInput === "") {
    console.log("Error: Fight ID list cannot be empty.");
    return;
  }

  const rawIds = orderInput.split(",").map((value) => value.trim());

  if (rawIds.some((value) => value === "")) {
    console.log("Error: invalid Fight ID list.");
    return;
  }

  const requestedFightIds: number[] = [];

  for (const rawId of rawIds) {
    const parsedId = parsePositiveInteger(rawId);

    if (parsedId === null) {
      console.log(`Error: invalid Fight ID: ${rawId}`);
      return;
    }

    requestedFightIds.push(parsedId);
  }

  const uniqueRequestedIds = new Set(requestedFightIds);

  if (uniqueRequestedIds.size !== requestedFightIds.length) {
    console.log("Error: duplicate Fight IDs are not allowed.");
    return;
  }

  const currentFightIds = currentFights.map((fight) => fight.id);
  const currentFightIdSet = new Set(currentFightIds);

  const nonexistentFightIds: number[] = [];
  const otherEventFightIds: number[] = [];
  const nullOrderFightIds: number[] = [];

  for (const requestedId of requestedFightIds) {
    if (currentFightIdSet.has(requestedId)) {
      continue;
    }

    const requestedFight = await prisma.fight.findUnique({
      where: { id: requestedId },
    });

    if (!requestedFight) {
      nonexistentFightIds.push(requestedId);
      continue;
    }

    if (requestedFight.eventId !== eventId) {
      otherEventFightIds.push(requestedId);
      continue;
    }

    if (requestedFight.fightOrder === null) {
      nullOrderFightIds.push(requestedId);
      continue;
    }
  }

  if (nonexistentFightIds.length > 0) {
    console.log(
      `Error: Fight not found: ${nonexistentFightIds.join(", ")}`
    );
    return;
  }

  if (otherEventFightIds.length > 0) {
    console.log(
      `Error: Fight belongs to another Event: ${otherEventFightIds.join(", ")}`
    );
    return;
  }

  if (nullOrderFightIds.length > 0) {
    console.log(
      `Error: fightOrder=null Fight cannot be reordered: ${nullOrderFightIds.join(
        ", "
      )}`
    );
    return;
  }

  if (requestedFightIds.length !== currentFightIds.length) {
    console.log(
      "Error: all currently ordered Fights must be specified exactly once."
    );
    return;
  }

  const missingFightIds = currentFightIds.filter(
    (id) => !uniqueRequestedIds.has(id)
  );

  const extraFightIds = requestedFightIds.filter(
    (id) => !currentFightIdSet.has(id)
  );

  if (missingFightIds.length > 0 || extraFightIds.length > 0) {
    console.log(
      "Error: Fight ID list does not exactly match the current ordered card."
    );

    if (missingFightIds.length > 0) {
      console.log(`Missing Fight IDs: ${missingFightIds.join(", ")}`);
    }

    if (extraFightIds.length > 0) {
      console.log(`Extra Fight IDs: ${extraFightIds.join(", ")}`);
    }

    return;
  }

  const currentOrderByFightId = new Map(
    currentFights.map((fight) => [fight.id, fight.fightOrder as number])
  );

  const proposedOrderByFightId = new Map(
    requestedFightIds.map((fightId, index) => [fightId, index + 1])
  );

  console.log("");
  console.log("========================================");
  console.log("FIGHT REORDER");
  console.log("========================================");

  console.log("");
  console.log("Environment");
  console.log(`- NODE_ENV: ${nodeEnv}`);
  console.log(`- Database: ${getSafeDatabaseTarget()}`);

  console.log("");
  console.log("Event");
  console.log(`- ID: ${event.id}`);
  console.log(`- name: ${event.name}`);
  console.log(`- Event Start: ${formatJstDateTime(event.date)}`);
  console.log(
    `- Prediction Deadline: ${formatJstDateTime(event.deadline)}`
  );

  console.log("");
  console.log("Current Card");
  console.log("");

  for (const fight of currentFights) {
    console.log(
      `${fight.fightOrder} | Fight ID ${fight.id} | ${formatFightCard(
        fight
      )} | ${fight.status}`
    );
  }

  console.log("");
  console.log("Proposed Card");
  console.log("");

  for (const [index, fightId] of requestedFightIds.entries()) {
    const fight = currentFights.find(
      (currentFight) => currentFight.id === fightId
    );

    if (!fight) {
      console.log("Error: internal Fight lookup failed.");
      return;
    }

    console.log(
      `${index + 1} | Fight ID ${fight.id} | ${formatFightCard(
        fight
      )} | ${fight.status}`
    );
  }

  console.log("");
  console.log("Changes");

  let hasOrderChange = false;

  for (const fightId of requestedFightIds) {
    const currentOrder = currentOrderByFightId.get(fightId);
    const proposedOrder = proposedOrderByFightId.get(fightId);

    if (currentOrder !== proposedOrder) {
      hasOrderChange = true;
    }

    console.log(
      `ID ${fightId}: ${currentOrder ?? "null"} -> ${proposedOrder}`
    );
  }

  if (!hasOrderChange) {
    console.log("");
    console.log("No order changes.");
    return;
  }

  console.log("");
  console.log(
    "No fighter, status, result, cancelReason, or Prediction data will be changed."
  );
  console.log(
    "fightOrder will be normalized to consecutive values 1 through N."
  );

  const previewNow = new Date();
  let eventStartedConfirmed = false;

  if (previewNow >= event.date) {
    const settledFight = currentFights.find(
      (fight) =>
        fight.status === "finished" ||
        fight.status === "draw" ||
        fight.status === "no_contest"
    );

    if (settledFight) {
      console.log("");
      console.log("Reorder rejected.");
      console.log("Event has already started and the ordered card contains");
      console.log(
        "a finished, draw, or no_contest Fight."
      );
      console.log(
        `Fight ID ${settledFight.id} status: ${settledFight.status}`
      );
      console.log("No database changes were made.");
      return;
    }

    console.log("");
    console.log("========================================");
    console.log("WARNING:");
    console.log("EVENT HAS ALREADY STARTED.");
    console.log("");
    console.log(
      "The ordered card currently contains only scheduled/cancelled Fights."
    );
    console.log(
      "Confirm that reordering the remaining card is intentional."
    );
    console.log("========================================");

    const startedAnswer = await rl.question(
      'Type "REORDER_AFTER_EVENT_START" to continue: '
    );

    if (startedAnswer !== "REORDER_AFTER_EVENT_START") {
      console.log("Confirmation failed. No database changes were made.");
      return;
    }

    eventStartedConfirmed = true;
  }

  console.log("");
  const confirmation = await rl.question(
    'Type "CONFIRM" to execute: '
  );

  if (confirmation !== "CONFIRM") {
    console.log("Confirmation failed. No database changes were made.");
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const latestEvent = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!latestEvent) {
        throw new Error("REORDER_EVENT_NOT_FOUND");
      }

      const latestFights = await tx.fight.findMany({
        where: {
          eventId,
          fightOrder: { not: null },
        },
        orderBy: [
          { fightOrder: "asc" },
          { id: "asc" },
        ],
      });

      const latestFightIds = latestFights.map((fight) => fight.id);
      const latestFightIdSet = new Set(latestFightIds);

      if (latestFightIdSet.size !== latestFightIds.length) {
        throw new Error("REORDER_LATEST_DUPLICATE_FIGHT");
      }

      if (uniqueRequestedIds.size !== requestedFightIds.length) {
        throw new Error("REORDER_REQUEST_DUPLICATE_FIGHT");
      }

      if (
        latestFightIds.length !== currentFightIds.length ||
        latestFightIdSet.size !== currentFightIdSet.size ||
        currentFightIds.some((id) => !latestFightIdSet.has(id))
      ) {
        throw new Error("REORDER_CARD_CHANGED");
      }

      if (
        requestedFightIds.length !== latestFightIds.length ||
        requestedFightIds.some((id) => !latestFightIdSet.has(id))
      ) {
        throw new Error("REORDER_CARD_CHANGED");
      }

      for (const fight of latestFights) {
        if (fight.eventId !== eventId) {
          throw new Error("REORDER_DIFFERENT_EVENT");
        }

        if (fight.fightOrder === null) {
          throw new Error("REORDER_FIGHT_ORDER_NULL");
        }
      }

      const transactionNow = new Date();

      if (transactionNow >= latestEvent.date) {
        const settledFight = latestFights.find(
          (fight) =>
            fight.status === "finished" ||
            fight.status === "draw" ||
            fight.status === "no_contest"
        );

        if (settledFight) {
          throw new Error("REORDER_SETTLED_FIGHT_AFTER_EVENT_START");
        }

        if (!eventStartedConfirmed) {
          throw new Error(
            "REORDER_EVENT_STARTED_CONFIRMATION_REQUIRED"
          );
        }
      }

      await tx.fight.updateMany({
        where: {
          eventId,
          id: { in: requestedFightIds },
        },
        data: {
          fightOrder: null,
        },
      });

      for (const [index, fightId] of requestedFightIds.entries()) {
        await tx.fight.update({
          where: { id: fightId },
          data: {
            fightOrder: index + 1,
          },
        });
      }
    });

    console.log("");
    console.log("Fight reorder completed successfully.");
    console.log(
      `fightOrder normalized to 1-${requestedFightIds.length}.`
    );
  } catch (error) {
    console.log("");
    console.log("Reorder failed. No Fight changes were committed.");

    if (error instanceof Error) {
      switch (error.message) {
        case "REORDER_EVENT_NOT_FOUND":
          console.log("Reason: Event no longer exists.");
          break;

        case "REORDER_CARD_CHANGED":
          console.log(
            "Reason: the current ordered card changed after the confirmation screen."
          );
          console.log(
            "Run Reorder fights again using the latest card."
          );
          break;

        case "REORDER_REQUEST_DUPLICATE_FIGHT":
        case "REORDER_LATEST_DUPLICATE_FIGHT":
          console.log("Reason: duplicate Fight IDs detected.");
          break;

        case "REORDER_DIFFERENT_EVENT":
          console.log(
            "Reason: a target Fight no longer belongs to this Event."
          );
          break;

        case "REORDER_FIGHT_ORDER_NULL":
          console.log(
            "Reason: a target Fight now has fightOrder=null."
          );
          break;

        case "REORDER_SETTLED_FIGHT_AFTER_EVENT_START":
          console.log(
            "Reason: Event has started and the ordered card now contains a finished, draw, or no_contest Fight."
          );
          break;

        case "REORDER_EVENT_STARTED_CONFIRMATION_REQUIRED":
          console.log(
            "Reason: Event started after the confirmation screen was displayed."
          );
          console.log(
            "Run Reorder fights again and explicitly confirm the post-start reorder."
          );
          break;

        default:
          console.log("Reason: transaction failed.");
          if (nodeEnv !== "production") {
            console.log(error.message);
          }
          break;
      }
    }
  }
};

const showFightMenu = async (): Promise<void> => {
  while (true) {
    console.log("");
    console.log("Fight Management");
    console.log("");
    console.log("1. Create Fight");
    console.log("2. Edit Fight");
    console.log("3. Cancel Fight");
    console.log("4. Replace card");
    console.log("5. Reorder fights");
    console.log("6. Back");
    console.log("");

    const choice = (await rl.question("Select: ")).trim();
    switch (choice) {
      case "1":
        await createFight();
        break;
      case "2":
        await editFight();
        break;
      case "3":
        await cancelFight();
        break;
      case "4":
        await replaceFight();
        break;
      case "5":
        await reorderFights();
        break;
      case "6":
        return;
      default:
        console.log("Invalid selection.");
        break;
    }
  }
};


const showMainMenu = async (): Promise<void> => {
  while (true) {
    console.log("");
    console.log("Fight Predict Admin");
    console.log("");
    console.log("1. Event");
    console.log("2. Fighter");
    console.log("3. Fight");
    console.log("4. Exit");
    console.log("");

    const choice = (await rl.question("Select: ")).trim();

    switch (choice) {
      case "1":
        await showEventMenu();
        break;

      case "2":
        await showFighterMenu();
        break;

      case "3":
        await showFightMenu();
        break;

      case "4":
        return;

      default:
        console.log("Invalid selection.");
        break;
    }
  }
};

const main = async (): Promise<void> => {
  console.log("");
  console.log("========================================");
  console.log("Fight Predict Admin");
  console.log("========================================");
  console.log(`NODE_ENV: ${nodeEnv}`);
  console.log(`Database: ${getSafeDatabaseTarget()}`);
  console.log("Admin datetime timezone: Asia/Tokyo (JST, UTC+09:00)");

  const confirmed =
    await requireProductionStartupConfirmation();

  if (!confirmed) {
    return;
  }

  await showMainMenu();
};

main()
  .catch((error) => {
    console.error("Admin CLI failed.");

    if (error instanceof Error) {
      console.error(error.message);
    } else {
      console.error("Unknown error");
    }

    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  }
);