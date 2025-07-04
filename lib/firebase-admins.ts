import admin from 'firebase-admin';

// Firebase Admin 앱이 중복 초기화되지 않도록 방지
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64!, 'base64').toString('utf-8')
  );

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

// ✅ Firebase Admin Auth 및 Firestore 인스턴스 export
export const adminAuth = admin.auth();
export const adminDb = admin.firestore();

export default admin;
