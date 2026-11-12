import { RestoreDiagnosticError } from "./restoreDiagnostics";

export function formatRestoreError(error: unknown): string {
  if (error instanceof RestoreDiagnosticError) {
    return `Restore verification FAILED. Stage: ${error.stage}, Code: ${error.code}`;
  }

  return "Restore verification FAILED. Unknown error.";
}
