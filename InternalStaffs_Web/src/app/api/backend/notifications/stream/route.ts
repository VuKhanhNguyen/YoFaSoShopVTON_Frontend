import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BASE = (
  process.env.BACKEND_API_BASE_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8080/api/v1"
).replace(/\/$/, "");

type TokenPair = { accessToken: string; refreshToken: string; user: unknown };

async function renewAccess(refreshToken: string): Promise<TokenPair | null> {
  try {
    const res = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as TokenPair;
  } catch {
    return null;
  }
}

/**
 * Proxy streaming SSE riêng biệt cho /api/v1/notifications/stream.
 * Không dùng arrayBuffer() hay AbortSignal.timeout(20000) để giữ kết nối thời gian thực ổn định.
 */
export async function GET(request: NextRequest) {
  let access = request.cookies.get("yofaso.access")?.value;
  const refresh = request.cookies.get("yofaso.refresh")?.value;
  const remember = request.cookies.get("yofaso.remember")?.value === "true";

  if (!access && !refresh) {
    return NextResponse.json({ message: "Chưa đăng nhập." }, { status: 401 });
  }

  const connect = (token?: string) =>
    fetch(`${BASE}/notifications/stream`, {
      method: "GET",
      headers: {
        Accept: "text/event-stream",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
      signal: request.signal,
    });

  try {
    let renewed: TokenPair | null = null;
    let upstream = await connect(access);
    if (upstream.status === 401 && refresh) {
      renewed = await renewAccess(refresh);
      if (renewed?.accessToken) {
        access = renewed.accessToken;
        upstream = await connect(access);
      }
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { message: "Không thể thiết lập luồng thông báo thời gian thực." },
        { status: upstream.status || 502 },
      );
    }

    const response = new NextResponse(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });

    if (renewed) {
      const options = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax" as const,
        path: "/",
      };
      response.cookies.set("yofaso.access", renewed.accessToken, {
        ...options,
        ...(remember ? { maxAge: 900 } : {}),
      });
      response.cookies.set("yofaso.refresh", renewed.refreshToken, {
        ...options,
        ...(remember ? { maxAge: 7 * 86400 } : {}),
      });
    }

    return response;
  } catch {
    return NextResponse.json(
      { message: "Kết nối SSE bị ngắt." },
      { status: 502 },
    );
  }
}
