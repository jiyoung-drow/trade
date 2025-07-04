import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // /admin 경로 이하일 때만 작동
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const isLoggedIn = request.cookies.get('firebaseAuthToken')?.value;

    if (!isLoggedIn) {
      const loginUrl = new URL('/admin/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
