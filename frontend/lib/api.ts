const DEFAULT_BACKEND_URL = "http://localhost:3001";

function getBackendUrl(): string {
  const configuredUrl = process.env.BACKEND_INTERNAL_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "BACKEND_INTERNAL_URL is required in production.",
      );
    }

    return DEFAULT_BACKEND_URL;
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error(
      "BACKEND_INTERNAL_URL must be a valid URL.",
    );
  }

  return configuredUrl.replace(/\/+$/, "");
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/")
    ? path
    : `/${path}`;

  if (typeof window !== "undefined") {
    return `/api${normalizedPath}`;
  }

  return `${getBackendUrl()}${normalizedPath}`;
}
