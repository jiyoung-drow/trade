import { cert, getApps, getApp, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { getAuth } from "firebase-admin/auth";

// ✅ 서비스 계정 키 가져오기 (.env.local에 JSON 문자열로 저장)
const rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!rawKey) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY is not defined.");
  throw new Error("환경 변수 FIREBASE_SERVICE_ACCOUNT_KEY가 설정되지 않았습니다.");
}

let parsedKey;
try {
  // 환경 변수 문자열에서 발생할 수 있는 추가 따옴표를 제거
  const cleanedKey = rawKey.startsWith('"') && rawKey.endsWith('"') ? rawKey.slice(1, -1) : rawKey;
  
  // 줄바꿈 문자 처리 (JSON 문자열에 \\n가 포함된 경우)
  const finalKey = cleanedKey.replace(/\\n/g, "\n");
  
  parsedKey = JSON.parse(finalKey);
} catch (e) {
  console.error("❌ FIREBASE_SERVICE_ACCOUNT_KEY 파싱 오류:", e);
  throw new Error("환경 변수 FIREBASE_SERVICE_ACCOUNT_KEY의 JSON 형식이 올바르지 않습니다.");
}

// ✅ Firebase Admin 설정
const firebaseAdminConfig = {
  credential: cert(parsedKey),
  storageBucket: `${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.appspot.com`,
};

// ✅ Firebase Admin 앱 초기화 (중복 방지)
// 이미 초기화된 앱이 있으면 가져오고, 없으면 새로 초기화합니다.
let adminApp;
if (getApps().length) {
  adminApp = getApp();
} else {
  adminApp = initializeApp(firebaseAdminConfig);
}

// ✅ 필요한 Firebase 서비스 export
export const adminDb = getFirestore(adminApp);
export const adminStorage = getStorage(adminApp);
export const adminAuth = getAuth(adminApp);