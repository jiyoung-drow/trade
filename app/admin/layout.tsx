import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { adminAuth, adminDb } from '@/lib/firebase-admins';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // ✅ 세션 쿠키 확인
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    console.warn('❌ 세션 쿠키 없음');
    return redirect('/admin/login');
  }

  try {
    const decodedToken = await adminAuth.verifySessionCookie(sessionCookie, true);
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
