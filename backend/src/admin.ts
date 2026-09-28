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

const showMainMenu = async (): Promise<void> => {
  while (true) {
    console.log("");
    console.log("Fight Predict Admin");
    console.log("");
    console.log("1. Event");
    console.log("2. Fighter");
    console.log("3. Exit");
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