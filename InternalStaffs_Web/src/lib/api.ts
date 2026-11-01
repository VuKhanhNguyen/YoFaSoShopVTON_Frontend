let lastActivity = Date.now();
let lastRenewal = Date.now();
let renewal: Promise<unknown> | null = null;
let closing = false;
export function noteActivity() {
  if (closing || document.visibilityState !== "visible") return;
  lastActivity = Date.now();
  if (lastActivity - lastRenewal < 60000 || renewal) return;
  lastRenewal = lastActivity;
  renewal = api("/auth/refresh", "POST")
    .catch((e: unknown) => {
      if (e instanceof ApiError && e.status === 401)
        window.dispatchEvent(new Event("yofaso:session-expired"));
    })
    .finally(() => {
      renewal = null;
    });
}
export async function logout() {
  closing = true;
  await renewal;
  await api("/auth/logout", "POST");
}
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields: Record<string, string> = {},
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  method = "GET",
  body?: unknown,
  key?: string,
  remember?: boolean,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/backend${path}`, {
      method,
      headers: {
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...(key ? { "Idempotency-Key": key } : {}),
        ...(remember !== undefined
          ? { "X-Yofaso-Remember": String(remember) }
          : {}),
        ...(typeof document !== "undefined" &&
        document.visibilityState === "visible" &&
        Date.now() - lastActivity < 60000
          ? { "X-Yofaso-Activity": "1" }
          : {}),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Không có kết nối mạng. Vui lòng thử lại.", 0);
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fields = result.details?.fields;
    if (
      response.status === 401 &&
      typeof window !== "undefined" &&
      !path.startsWith("/auth/") &&
      document.visibilityState === "visible" &&
      Date.now() - lastActivity < 60000
    )
      window.dispatchEvent(new Event("yofaso:session-expired"));
    throw new ApiError(
      result.message || "Không thực hiện được thao tác.",
      response.status,
      Array.isArray(fields)
        ? Object.fromEntries(
            fields.map((f: { field: string; message: string }) => [
              f.field,
              f.message,
            ]),
          )
        : {},
    );
  }
  if (path === "/auth/login") {
    closing = false;
    lastActivity = lastRenewal = Date.now();
  }
  return result as T;
}
export const assetUrl = (assetId: string) =>
  `/api/backend/assets/${encodeURIComponent(assetId)}/content`;
export const catalogImage = (url: string) =>
  url.replace(/^\/api\/v1\//, "/api/backend/");
export const requestKey = () => crypto.randomUUID();
