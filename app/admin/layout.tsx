// app/admin/layout.tsx

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admins';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ 로그인 페이지 접근 시 인증 로직 무시하여 무한 리디렉션 방지
  if (typeof window !== 'undefined' && window.location.pathname === '/admin/login') {
    return <>{children}</>;
  }

  // ✅ 세션 쿠키 확인
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    console.warn('❌ 세션 쿠키 없음');
    return redirect('/admin/login');
  }

  try {
    // ✅ 세션 유효성 검증
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);

    // ✅ 관리자 권한 확인
    const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();

    if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
      console.warn('❌ 관리자 권한 없음');
      return redirect('/admin/login');
    }
  } catch (error) {
    console.error('❌ 세션 검증 실패:', error);
    return redirect('/admin/login');
  }

  return <>{children}</>;
}
