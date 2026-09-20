import { getAccessToken } from "@/lib/api/supabase";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface ApiErrorShape {
  code: string;
  message: string;
  details?: unknown;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;
  requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractError(status: number, data: unknown, requestId?: string): ApiError {
  if (isRecord(data) && isRecord(data.error)) {
    const error = data.error;
    const code = typeof error.code === "string" ? error.code : "API_ERROR";
    const message = typeof error.message === "string" ? error.message : `Request failed (${status})`;
    return new ApiError(status, code, message, error.details, requestId);
  }
  return new ApiError(status, "API_ERROR", `Request failed (${status})`, undefined, requestId);
}

export interface ApiOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
}

export async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { token, timeoutMs = 30_000, headers = {}, ...rest } = options;
  const authToken = token === undefined ? await getAccessToken() : token;

  const initHeaders = new Headers(headers);
  if (rest.body !== undefined && !(rest.body instanceof FormData)) {
    initHeaders.set("Content-Type", "application/json");
  }
  const outgoingRequestId =
    typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  initHeaders.set("X-Request-ID", outgoingRequestId);
  if (authToken) {
    initHeaders.set("Authorization", `Bearer ${authToken}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...rest,
      headers: initHeaders,
      body: rest.body instanceof FormData || rest.body === undefined ? rest.body : JSON.stringify(rest.body),
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Could not reach the Puvexa API. Is the backend running?",
      undefined,
      outgoingRequestId,
    );
  } finally {
    clearTimeout(timer);
  }

  const echoedRequestId = response.headers.get("x-request-id") ?? outgoingRequestId;

  const text = await response.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw extractError(response.status, data, echoedRequestId);
  }
  return data as T;
}

export async function apiGet<T>(path: string, token?: string | null): Promise<T> {
  return apiFetch<T>(path, { method: "GET", token });
}

export function apiDelete<T>(path: string, token?: string | null): Promise<T> {
  return apiFetch<T>(path, { method: "DELETE", token });
}

export function apiPost<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body, token });
}

export function apiPatch<T>(path: string, body?: unknown, token?: string | null): Promise<T> {
  return apiFetch<T>(path, { method: "PATCH", body, token });
}

export function apiFormPost<T>(path: string, form: FormData): Promise<T> {
  return apiFetch<T>(path, { method: "POST", body: form });
}