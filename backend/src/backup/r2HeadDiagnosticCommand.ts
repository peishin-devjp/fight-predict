import {
  HeadDiagnosticConfigError,
  runSingleHeadDiagnostic,
} from "./r2HeadDiagnostic";
import { formatRestoreError } from "./restoreErrorOutput";
import { RestoreDiagnosticError } from "./restoreDiagnostics";

async function main(): Promise<void> {
  if (
    process.argv.length !== 2 ||
    process.env.NODE_OPTIONS !== undefined
  ) {
    console.error("Single HEAD diagnostic configuration rejected.");
    process.exitCode = 1;
    return;
  }

  try {
    await runSingleHeadDiagnostic();
    console.log("Single HEAD diagnostic PASS.");
  } catch (error: unknown) {
    if (error instanceof RestoreDiagnosticError) {
      console.error(formatRestoreError(error));
    } else if (error instanceof HeadDiagnosticConfigError) {
      console.error("Single HEAD diagnostic configuration rejected.");
    } else {
      console.error("Single HEAD diagnostic FAILED. Unknown error.");
    }

    process.exitCode = 1;
  }
}

void main();
