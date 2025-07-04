// app/admin/layout.tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/firebase-admins';
import { getFirestore } from 'firebase-admin/firestore';
import { cookies } from 'next/headers';
import { initializeApp, cert, getApps } from 'firebase-admin/app';

// Firebase Admin 초기화
if (!getApps().length) {
  initializeApp({
    credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON!)),
  });
}

const db = getFirestore();

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ip = headers().get('x-forwarded-for') || '';
  const userIP = ip.split(',')[0].trim();

  const allowedIPs = ['122.37.165.144'];
  if (!allowedIPs.includes(userIP)) {
    return redirect('/admin/login');
  }

  // Firebase Auth 세션 확인
  const sessionCookie = cookies().get('__session')?.value;
  if (!sessionCookie) {
    return redirect('/admin/login');
  }

  let decodedToken;
  try {
    decodedToken = await auth().verifySessionCookie(sessionCookie, true);
  } catch (error) {
    console.error('Session verification failed:', error);
    return redirect('/admin/login');
  }

  // 관리자 권한 확인
  const userDoc = await db.collection('users').doc(decodedToken.uid).get();
  const userData = userDoc.data();
  if (!userData || (userData.role !== 'admin' && userData.role !== 'superadmin')) {
    return redirect('/admin/login');
  }

  return <>{children}</>;
}
