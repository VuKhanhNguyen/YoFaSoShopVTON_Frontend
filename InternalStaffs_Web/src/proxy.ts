import { NextResponse, type NextRequest } from "next/server";

type Role =
  | "ROLE_SHOP_ADMIN"
  | "ROLE_STAFF_CASHIER"
  | "ROLE_STAFF_WAREHOUSE"
  | "ROLE_STAFF_SHIPPER";

const VALID_ROLES: readonly Role[] = [
  "ROLE_SHOP_ADMIN",
  "ROLE_STAFF_CASHIER",
  "ROLE_STAFF_WAREHOUSE",
  "ROLE_STAFF_SHIPPER",
];

const RBAC_LOG_COOKIE = "yofaso.rbac_log";

function roleHome(role: Role): string {
  switch (role) {
    case "ROLE_SHOP_ADMIN":
      return "/admin/dashboard";
    case "ROLE_STAFF_CASHIER":
      return "/pos/terminal";
    case "ROLE_STAFF_WAREHOUSE":
      return "/warehouse/fulfillment";
    case "ROLE_STAFF_SHIPPER":
      return "/shipper/deliveries";
  }
}

function resolveStaffRole(roles: unknown): Role | null {
  if (!Array.isArray(roles)) return null;
  for (const r of VALID_ROLES) {
    if (roles.includes(r)) return r;
  }
  return null;
}

function requiredRoleForPath(pathname: string): Role | null {
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return "ROLE_SHOP_ADMIN";
  }
  if (pathname === "/pos" || pathname.startsWith("/pos/")) {
    return "ROLE_STAFF_CASHIER";
  }
  if (pathname === "/warehouse" || pathname.startsWith("/warehouse/")) {
    return "ROLE_STAFF_WAREHOUSE";
  }
  if (pathname === "/shipper" || pathname.startsWith("/shipper/")) {
    return "ROLE_STAFF_SHIPPER";
  }
  if (pathname === "/workspace" || pathname.startsWith("/workspace/")) {
    const seg = pathname.split("/")[2] || "";
    if (seg === "pos") return "ROLE_STAFF_CASHIER";
    if (seg === "warehouse" || seg === "orders") return "ROLE_STAFF_WAREHOUSE";
    if (seg === "deliveries") return "ROLE_STAFF_SHIPPER";
    return "ROLE_SHOP_ADMIN";
  }
  return null;
}

function decodeJwtPayload(token: string): { exp?: number; roles?: unknown } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const raw = Buffer.from(parts[1], "base64url").toString("utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function attachRbacConsoleCookie(
  request: NextRequest,
  response: NextResponse,
  payload: {
    blockedPath: string;
    currentRole?: string | null;
    requiredRole: string;
    redirectedTo: string;
    reason: "UNAUTHENTICATED" | "FORBIDDEN_ROLE";
  },
) {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  response.cookies.set(RBAC_LOG_COOKIE, encoded, {
    httpOnly: false,
    secure: request.nextUrl.protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 15,
  });
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const requiredRole = requiredRoleForPath(pathname);
  if (!requiredRole) return NextResponse.next();

  const access = request.cookies.get("yofaso.access")?.value;
  const refresh = request.cookies.get("yofaso.refresh")?.value;
  const blockedPath = `${pathname}${search}`;

  if (!access && !refresh) {
    const res = NextResponse.redirect(new URL("/login", request.url));
    attachRbacConsoleCookie(request, res, {
      blockedPath,
      currentRole: null,
      requiredRole,
      redirectedTo: "/login",
      reason: "UNAUTHENTICATED",
    });
    return res;
  }

  if (access) {
    const payload = decodeJwtPayload(access);
    if (payload) {
      const notExpired =
        typeof payload.exp !== "number" || payload.exp * 1000 > Date.now();
      if (notExpired) {
        const role = resolveStaffRole(payload.roles);
        if (!role) {
          const res = NextResponse.redirect(new URL("/login", request.url));
          res.cookies.set("yofaso.access", "", { httpOnly: true, path: "/", maxAge: 0 });
          res.cookies.set("yofaso.refresh", "", { httpOnly: true, path: "/", maxAge: 0 });
          res.cookies.set("yofaso.remember", "", { httpOnly: true, path: "/", maxAge: 0 });
          attachRbacConsoleCookie(request, res, {
            blockedPath,
            currentRole: "NON_STAFF",
            requiredRole,
            redirectedTo: "/login",
            reason: "FORBIDDEN_ROLE",
          });
          return res;
        }

        if (role !== requiredRole) {
          const target = roleHome(role);
          const res = NextResponse.redirect(new URL(target, request.url));
          attachRbacConsoleCookie(request, res, {
            blockedPath,
            currentRole: role,
            requiredRole,
            redirectedTo: target,
            reason: "FORBIDDEN_ROLE",
          });
          return res;
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    {
      source: "/admin/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/pos/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/warehouse/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/shipper/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
    {
      source: "/workspace/:path*",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
