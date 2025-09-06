// lib/firebase-admin.ts

import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

// ✅ 서비스 계정 키 가져오기 (.env.local에 JSON 문자열로 저장)
const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!rawKey) {
  throw new Error("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not defined in .env.local");
}

let parsedKey;
try {
  parsedKey = JSON.parse(rawKey);
  parsedKey.private_key = parsedKey.private_key.replace(/\\n/g, "\n");
} catch (e) {
  throw new Error("❌ FIREBASE_SERVICE_ACCOUNT_KEY 파싱 오류: .env 파일의 JSON 문자열 확인 필요");
}

// ✅ Firebase Admin 설정
const firebaseAdminConfig = {
  credential: cert(parsedKey),
  storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
};

// ✅ Firebase Admin 앱 초기화 (중복 방지)
const adminApp = getApps().length ? getApp() : initializeApp(firebaseAdminConfig);

// ✅ 필요한 Firebase 서비스 export
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminAuth = getAuth(adminApp);
