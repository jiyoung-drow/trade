// /app/api/admin/deleteUser/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminAuth, adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // ✅ 1. 관리자 인증 체크
  if (!session || session.user?.email !== "shepollux@gmail.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { uid } = body;

    // ✅ 2. UID 유효성 검사
    if (!uid || typeof uid !== "string") {
      return NextResponse.json({ error: "Missing or invalid UID" }, { status: 400 });
    }

    // ✅ 3. Firestore 유저 문서 삭제
    await adminDb.collection("users").doc(uid).delete();

    // ✅ 4. Firebase 인증 사용자 삭제
    await adminAuth.deleteUser(uid);

    console.log(`✅ 사용자 ${uid} 삭제 완료`);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ deleteUser 오류:", error);
    return NextResponse.json({ error: "서버 오류로 삭제 실패" }, { status: 500 });
  }
}
