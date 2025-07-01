// lib/admin.ts

import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

// Vercel 및 로컬 환경 변수 연동 필요:
// NEXT_PUBLIC_FIREBASE_PROJECT_ID
// FIREBASE_CLIENT_EMAIL
// FIREBASE_PRIVATE_KEY

if (!getApps().length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

// 관리자용 Firestore 및 Auth 객체 내보내기
export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
