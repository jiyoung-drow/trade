import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

// ✅ 환경 변수에서 파이어베이스 서비스 계정 키를 가져옵니다.
const firebaseServiceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!firebaseServiceAccountKey) {
  console.error("❌ 오류: FIREBASE_SERVICE_ACCOUNT_KEY 환경 변수가 설정되지 않았습니다.");
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY environment variable.");
}

// ✅ 한 줄로 된 JSON 문자열을 JavaScript 객체로 파싱합니다.
// 이렇게 하면 `project_id`, `client_email`, `private_key` 등 모든 값이 한 번에 처리됩니다.
const serviceAccount = JSON.parse(firebaseServiceAccountKey);

// ✅ Firebase Admin SDK를 초기화합니다.
if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount),
  });
  console.log("✅ Firebase Admin SDK 초기화 성공.");
}

// ✅ GET 요청으로 Firebase Custom Token 발급
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = (session?.user as any)?.id;
    const email = session?.user?.email;

    if (!uid) {
      console.warn("❌ 사용자 ID 없음 - 인증 필요");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ 사용자 ID를 기반으로 커스텀 토큰을 생성합니다.
    const token = await getAuth().createCustomToken(uid, {
      email: email ?? undefined,
    });

    console.log("✅ Firebase 커스텀 토큰 생성 완료:", uid);
    return NextResponse.json({ firebaseToken: token });
  } catch (error) {
    console.error("❌ Firebase 토큰 생성 실패:", error);
    return NextResponse.json(
      { error: "Failed to generate token" },
      { status: 500 }
    );
  }
}
