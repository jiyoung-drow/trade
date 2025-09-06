// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });

  const isAdmin = token?.email === "shepollux@gmail.com";

  // ✅ 관리자가 아닌데 /admin 경로 접근 시 → 홈으로 이동
  if (req.nextUrl.pathname.startsWith("/admin") && !isAdmin) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  // ✅ 관리자인데 /admin 이외 경로 접근 시 → /admin으로 리디렉트 (선택사항)
  if (
    isAdmin &&
    !req.nextUrl.pathname.startsWith("/admin") &&
    !req.nextUrl.pathname.startsWith("/api")
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// ✅ middleware 적용할 경로 설정
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
