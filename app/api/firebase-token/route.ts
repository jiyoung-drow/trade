// app/api/firebase-token/route.ts

import { NextResponse } from "next/server";
import { getAuth } from "firebase-admin/auth";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ✅ 경로 수정

// ✅ Firebase Admin SDK 초기화 (앱 중복 방지)
if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

// ✅ GET 요청으로 Firebase Custom Token 발급
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const uid = (session?.user as any)?.id;
    const email = session?.user?.email;

    console.log("✅ 세션 정보:", session);

    if (!uid) {
      console.warn("❌ 사용자 ID 없음 - 인증 필요");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ✅ 사용자 ID 기반으로 커스텀 토큰 생성
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
