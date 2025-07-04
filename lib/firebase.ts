// lib/firebase.ts

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// ✅ Firebase 환경 변수 설정
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// ✅ 이미 초기화된 앱이 있으면 재사용, 없으면 초기화
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// ✅ Firebase 서비스 export
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// ✅ 브라우저 Local Persistence 설정 (최초에 한 번만 실행)
if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence)
    .then(() => {
      console.log('✅ Firebase Auth persistence set to local');
    })
    .catch((error) => {
      console.error('❌ Failed to set Firebase Auth persistence', error);
    });
}

// 필요 시 app 자체도 export
export default app;
