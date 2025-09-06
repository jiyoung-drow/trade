// /app/api/admin/getUsers/route.ts

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase-admin"; // Firebase Admin SDK
import { adminDb } from "@/lib/firebase-admin"; // Firestore Admin

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  // ✅ 관리자 보호
  if (!session || session.user.email !== "shepollux@gmail.com") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    const snapshot = await adminDb.collection("users").get();

    const users = snapshot.docs.map((doc) => ({
      uid: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error("getUsers 에러:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
