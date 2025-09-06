// src/firebaseConfig.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';


// !!! 중요: 아래 'YOUR_...' 플레이스홀더를 여러분의 실제 Firebase 프로젝트 설정 값으로 교체하세요. !!!
const firebaseConfig = {
  apiKey: "AIzaSyCtUI89SjLFp52BFEV7G2fEXe78GzZBtFk", // 예: "AIzaSy..."
  authDomain: "rade-17ada.firebaseapp.com", // 예: "your-project-id.firebaseapp.com"
  projectId: "trade-17ada", // 예: "your-project-id"
  storageBucket: "trade-17ada.firebasestorage.app", // 예: "your-project-id.appspot.com"
  messagingSenderId: "1066191350910", // 예: "1234567890"
  appId: "1:1066191350910:web:04f9d82f0634854d867c2f" // 예: "1:1234567890:web:abcdef123456"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// 필요한 Firebase 서비스 초기화
const auth = getAuth(app);
const db = getFirestore(app);
// Cloud Functions 클라이언트 서비스 초기화


// 다른 파일에서 사용할 수 있도록 export
export { auth, db, };
