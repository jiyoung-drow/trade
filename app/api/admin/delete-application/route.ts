// /app/api/admin/delete-application/route.ts

import { NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return new Response("ID가 없습니다", { status: 400 });
    }

    const docRef = adminDb.collection("applications").doc(id);
    await docRef.delete();

    return new Response("Deleted", { status: 200 });
  } catch (e) {
    console.error("❌ 관리자 삭제 실패:", e);
    return new Response("Delete failed", { status: 500 });
  }
}
