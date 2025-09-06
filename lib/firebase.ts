// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions"; // Cloud Functions를 사용하기 위한 import

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyCtUI89SjLFp52BFEV7G2fEXe78GzZBtFk",
  authDomain: "trade-17ada.firebaseapp.com",
  projectId: "trade-17ada",
  storageBucket: "trade-17ada.firebasestorage.app",
  messagingSenderId: "1066191350910",
  appId: "1:1066191350910:web:04f9d82f0634854d867c2f",
};

// Firebase 앱 초기화: 이미 초기화된 앱이 있으면 그것을 사용하고, 없으면 새로 초기화합니다.
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestore 서비스 인스턴스 가져오기
const db = getFirestore(app);
// Authentication 서비스 인스턴스 가져오기
const auth = getAuth(app);
// Cloud Functions 서비스 인스턴스 가져오기
const functions = getFunctions(app);

// 필요한 Firebase 서비스 인스턴스들을 export 합니다.
export { db, auth, functions };
