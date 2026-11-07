import { runRestoreVerification } from "./restoreCli";

runRestoreVerification().catch((error: unknown) => {
  console.error(
    "Restore verification FAILED.",
    error instanceof Error ? error.message : "Unknown error",
  );

  process.exitCode = 1;
});