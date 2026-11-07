const REQUEST_TIMEOUT_MS = 10_000;

async function sendPing(url: string): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Healthchecks ping failed with HTTP ${response.status}.`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function notifyBackupSuccess(
  pingUrl: string | undefined,
): Promise<void> {
  if (!pingUrl) {
    return;
  }

  await sendPing(pingUrl);
}

export async function notifyBackupFailure(
  pingUrl: string | undefined,
): Promise<void> {
  if (!pingUrl) {
    return;
  }

  const failUrl = `${pingUrl.replace(/\/+$/, "")}/fail`;
  await sendPing(failUrl);
}