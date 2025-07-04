import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 관리자 경로만 인증 적용, /admin/login 제외
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const sessionCookie = req.cookies.get('__session')?.value;
    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};