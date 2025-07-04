// middleware.ts

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 관리자 경로에만 인증 적용, /admin/login 제외
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const sessionCookie = req.cookies.get('__session')?.value;

    if (!sessionCookie) {
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }

    // ✅ 관리자 IP 제한 (옵션)
    const allowedIPs = ['122.37.165.144'];
    const ip = req.headers.get('x-forwarded-for') || '';
    const userIP = ip.split(',')[0].trim();

    if (!allowedIPs.includes(userIP)) {
      console.warn(`❌ 차단된 IP 접근 시도: ${userIP}`);
      return NextResponse.redirect(new URL('/admin/login', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
