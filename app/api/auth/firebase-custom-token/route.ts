// App Router용: app/api/auth/firebase-custom-token/route.ts
// Pages Router용: pages/api/auth/firebase-custom-token.ts (아래 코드에서 NextApiRequest/Response 사용)

// Firebase Admin SDK 초기화 (단 한 번만 초기화되어야 합니다)
import * as admin from 'firebase-admin';
import { NextResponse } from 'next/server'; // App Router용
// import { NextApiRequest, NextApiResponse } from 'next'; // Pages Router용

// 환경 변수에서 Firebase 서비스 계정 키를 로드합니다.
// .env.local에 FIREBASE_SERVICE_ACCOUNT_KEY='{...json 내용...}' 형태로 저장
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string)),
    });
    console.log("Firebase Admin SDK 초기화 성공.");
  } catch (error) {
    console.error("Firebase Admin SDK 초기화 오류:", error);
    // 초기화 실패 시 앱이 작동하지 않으므로, 여기서 오류를 명확히 기록합니다.
  }
}

// App Router API Route (route.ts)
export async function POST(request: Request) {
  console.log("DEBUG: [API Route] POST 요청 수신됨.");
  try {
    const { uid } = await request.json();
    console.log("DEBUG: [API Route] 요청 본문 UID:", uid);

    if (!uid) {
      console.log("DEBUG: [API Route] UID가 누락되었습니다.");
      return NextResponse.json({ error: 'UID is required' }, { status: 400 });
    }

    // Firebase Admin SDK를 사용하여 커스텀 토큰 생성
    const customToken = await admin.auth().createCustomToken(uid);
    console.log("DEBUG: [API Route] 커스텀 토큰 생성 성공.");
    return NextResponse.json({ token: customToken });
  } catch (error: any) {
    console.error("DEBUG: [API Route] 커스텀 토큰 생성 중 오류 발생:", error);
    // JSON 파싱 오류 등 다양한 오류 처리
    return NextResponse.json({ error: 'Failed to create custom token', details: error.message }, { status: 500 });
  }
}