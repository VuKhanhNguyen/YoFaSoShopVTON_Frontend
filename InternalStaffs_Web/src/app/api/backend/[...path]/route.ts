import { NextRequest, NextResponse } from "next/server";
import contract from "@/lib/routes.json";
const BASE = (
  process.env.BACKEND_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080/api/v1"
).replace(/\/$/, "");
type TokenPair = { accessToken: string; refreshToken: string; user: unknown };
const refreshes = new Map<string, Promise<TokenPair | null>>();
function allowed(path: string, method: string) {
  return contract.some(
    (route) =>
      route.method === method &&
      new RegExp(`^${route.path.replace(/\{[^}]+\}/g, "[^/]+")}$`).test(path),
  );
}
function session(
  response: NextResponse,
  tokens: TokenPair | null,
  remember = false,
) {
  response.headers.set("Cache-Control", "no-store");
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
  response.cookies.set("yofaso.access", tokens?.accessToken || "", {
    ...options,
    ...(tokens ? (remember ? { maxAge: 900 } : {}) : { maxAge: 0 }),
  });
  response.cookies.set("yofaso.refresh", tokens?.refreshToken || "", {
    ...options,
    ...(tokens ? (remember ? { maxAge: 7 * 86400 } : {}) : { maxAge: 0 }),
  });
  response.cookies.set("yofaso.remember", tokens ? String(remember) : "", {
    ...options,
    ...(tokens ? (remember ? { maxAge: 7 * 86400 } : {}) : { maxAge: 0 }),
  });
}
async function renew(token: string) {
  if (!refreshes.has(token)) {
    const promise = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: token }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    })
      .then(async (r) => {
        if (r.status === 401) return null;
        if (!r.ok) throw new Error("Refresh unavailable");
        return (await r.json()) as TokenPair;
      })
      .finally(() => {
        setTimeout(() => refreshes.delete(token), 5000);
      });
    refreshes.set(token, promise);
  }
  return refreshes.get(token)!;
}
async function handle(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const segments = (await context.params).path;
  if (segments.some((p) => p === "." || p === ".." || /[\\/\x00]/.test(p)))
    return NextResponse.json(
      { message: "Đường dẫn không hợp lệ." },
      { status: 400 },
    );
  const path = "/" + segments.map(encodeURIComponent).join("/");
  if (!allowed(path, request.method))
    return NextResponse.json(
      { message: "Không có thao tác này." },
      { status: 404 },
    );
  if (
    !["GET", "HEAD"].includes(request.method) &&
    request.headers.get("origin") !== request.nextUrl.origin
  )
    return NextResponse.json(
      { message: "Nguồn yêu cầu không hợp lệ." },
      { status: 403 },
    );
  const access = request.cookies.get("yofaso.access")?.value,
    refresh = request.cookies.get("yofaso.refresh")?.value;
  const remember = request.cookies.get("yofaso.remember")?.value === "true";
  // Refresh được đổi bằng cookie HttpOnly; JavaScript không được cung cấp/nhận token.
  if (path === "/auth/refresh") {
    if (
      request.method !== "POST" ||
      request.headers.get("x-yofaso-activity") !== "1"
    )
      return NextResponse.json(
        { message: "Cần thao tác từ ứng dụng." },
        { status: 403 },
      );
    let tokens: TokenPair | null;
    try {
      tokens = refresh ? await renew(refresh) : null;
    } catch {
      return NextResponse.json(
        { message: "Chưa thể gia hạn phiên. Vui lòng thử lại khi có mạng." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }
    const response = NextResponse.json(
      tokens ? { renewed: true } : { message: "Phiên đăng nhập đã hết hạn." },
      { status: tokens ? 200 : 401 },
    );
    session(response, tokens, remember);
    return response;
  }
  const auth = ["/auth/login", "/auth/register"].includes(path);
  // Cổng nhân sự không có đăng ký công khai hoặc nhận token từ JavaScript.
  if (path === "/auth/register")
    return NextResponse.json(
      { message: "Tài khoản nhân sự do chủ shop cấp." },
      { status: 403 },
    );
  let body: ArrayBuffer | string | undefined = ["GET", "HEAD"].includes(
    request.method,
  )
    ? undefined
    : await request.arrayBuffer();
  if (path === "/auth/logout")
    body = JSON.stringify({ refreshToken: refresh || "" });
  const call = (token?: string) =>
    fetch(`${BASE}${path}${request.nextUrl.search}`, {
      method: request.method,
      body,
      headers: {
        ...(request.headers.get("content-type")
          ? { "Content-Type": request.headers.get("content-type")! }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(request.headers.get("idempotency-key")
          ? { "Idempotency-Key": request.headers.get("idempotency-key")! }
          : {}),
      },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(path === "/assets" ? 60000 : 20000),
    });
  try {
    let tokens: TokenPair | null | undefined,
      upstream = await call(access);
    if (
      upstream.status === 401 &&
      refresh &&
      (!path.startsWith("/auth/") || path === "/auth/logout")
    ) {
      tokens =
        request.headers.get("x-yofaso-activity") === "1"
          ? await renew(refresh)
          : undefined;
      if (tokens) {
        if (path === "/auth/logout")
          body = JSON.stringify({ refreshToken: tokens.refreshToken });
        upstream = await call(tokens.accessToken);
      }
    }
    const type = upstream.headers.get("content-type") || "application/json";
    if (auth && upstream.ok) {
      tokens = (await upstream.json()) as TokenPair;
      const response = NextResponse.json({ user: tokens.user });
      session(
        response,
        tokens,
        request.headers.get("x-yofaso-remember") === "true",
      );
      return response;
    }
    const response = new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        "Content-Type": type,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
    if (tokens !== undefined) session(response, tokens, remember);
    if (path === "/auth/logout" || (upstream.status === 401 && tokens === null))
      session(response, null);
    return response;
  } catch {
    const response = NextResponse.json(
      { message: "Không kết nối được backend. Kiểm tra dịch vụ và thử lại." },
      { status: 502 },
    );
    if (path === "/auth/logout") session(response, null);
    return response;
  }
}
export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
