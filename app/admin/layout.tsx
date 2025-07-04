// app/admin/layout.tsx

import { headers, cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admins';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ IP 제한
  const ip = headers().get('x-forwarded-for') || '';
  const userIP = ip.split(',')[0].trim();

  const allowedIPs = ['122.37.165.144'];
  if (!allowedIPs.includes(userIP)) {
    console.warn(`차단된 IP 접근 시도: ${userIP}`);
    return redirect('/admin/login');
  }

  // ✅ 세션 쿠키 확인
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    console.warn('세션 쿠키 없음');
    return redirect('/admin/login');
  }

  let decodedToken;
  try {
    decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
  } catch (error) {
    console.error('세션 검증 실패:', error);
    return redirect('/admin/login');
  }

  // ✅ 관리자 권한 확인
  const userDoc = await adminDb.collection('users').doc(decodedToken.uid).get();
  const userData = userDoc.data();
  if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
    console.warn('관리자 권한 없음');
    return redirect('/admin/login');
  }

  return <>{children}</>;
}
