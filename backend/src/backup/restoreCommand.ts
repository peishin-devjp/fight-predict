import { runRestoreVerification } from "./restoreCli";
import { formatRestoreError } from "./restoreErrorOutput";

runRestoreVerification(process.argv.slice(2)).catch((error: unknown) => {
  console.error(formatRestoreError(error));
  process.exitCode = 1;
});
