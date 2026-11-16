import { NextRequest, NextResponse } from "next/server";

const PUBLIC = ["/", "/masuk", "/daftar"];

// Gerbang ringan: cookie sesi harus ada. Validasi sebenarnya dilakukan di Express.
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const has = req.cookies.has("wf_refresh") || req.cookies.has("wf_access");
  const isPublic = PUBLIC.includes(pathname);
  if (!has && !isPublic) return NextResponse.redirect(new URL("/masuk", req.url));
  if (has && (pathname === "/masuk" || pathname === "/daftar")) return NextResponse.redirect(new URL("/dashboard", req.url));
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next|favicon.ico).*)"] };
