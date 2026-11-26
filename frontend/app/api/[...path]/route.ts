import { NextRequest, NextResponse } from "next/server";

const DEFAULT_BACKEND_URL = "http://localhost:3001";

function getBackendBaseUrl(): string {
  const configuredUrl = process.env.BACKEND_INTERNAL_URL;

  if (!configuredUrl) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "BACKEND_INTERNAL_URL is required in production.",
      );
    }

    return DEFAULT_BACKEND_URL;
  }

  try {
    new URL(configuredUrl);
  } catch {
    throw new Error(
      "BACKEND_INTERNAL_URL must be a valid URL.",
    );
  }

  return configuredUrl.replace(/\/+$/, "");
}

function getBackendUrl(
  request: NextRequest,
  path: string[],
): string {
  const baseUrl = getBackendBaseUrl();
  const backendPath = path
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `${baseUrl}/${backendPath}${request.nextUrl.search}`;
}

async function proxyRequest(
  request: NextRequest,
  path: string[],
): Promise<NextResponse> {
  const headers = new Headers();

  const contentType = request.headers.get("content-type");
  const cookie = request.headers.get("cookie");
  const origin = request.headers.get("origin");

  if (contentType) {
    headers.set("content-type", contentType);
  }

  if (cookie) {
    headers.set("cookie", cookie);
  }

  if (origin) {
    headers.set("origin", origin);
  }

  const hasBody =
    request.method !== "GET" && request.method !== "HEAD";

  const body = hasBody
    ? await request.arrayBuffer()
    : undefined;

  let backendResponse: Response;

  try {
    backendResponse = await fetch(
      getBackendUrl(request, path),
      {
        method: request.method,
        headers,
        body,
        redirect: "manual",
        cache: "no-store",
      },
    );
  } catch (error) {
    console.error("Backend proxy request failed:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Backend service unavailable",
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers();

  const responseContentType =
    backendResponse.headers.get("content-type");

  if (responseContentType) {
    responseHeaders.set(
      "content-type",
      responseContentType,
    );
  }

  const setCookies = backendResponse.headers.getSetCookie();

  for (const setCookie of setCookies) {
    responseHeaders.append("set-cookie", setCookie);
  }

  const responseBody = await backendResponse.arrayBuffer();

  return new NextResponse(responseBody, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handleRequest(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { path } = await context.params;

  return proxyRequest(request, path);
}

export const GET = handleRequest;
export const POST = handleRequest;
export const PUT = handleRequest;
export const PATCH = handleRequest;
export const DELETE = handleRequest;
