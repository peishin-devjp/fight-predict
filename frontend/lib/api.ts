const DEFAULT_API_BASE_URL = "http://localhost:3001";

function getApiBaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "NEXT_PUBLIC_API_BASE_URL is required in production.",
      );
    }

    return DEFAULT_API_BASE_URL;
  }

  let parsedUrl: URL;


  try {
    parsedUrl = new URL(configuredUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be a valid URL.");
  }

  if (
    process.env.NODE_ENV === "production" &&
    parsedUrl.protocol !== "https:"
  ) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL must use HTTPS in production.",
    );
  }

  return configuredUrl.replace(/\/+$/, "");
}

export const API_BASE_URL = getApiBaseUrl();

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
}