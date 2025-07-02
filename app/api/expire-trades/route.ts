import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const now = Date.now();
    const tenMinutesAgo = now - 600_000;

    const snapshot = await adminDb
      .collection("items")
      .where("status", "==", "in-progress")
      .get();

    const batch = adminDb.batch();
    let expiredCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.startedAt?.toDate().getTime() < tenMinutesAgo) {
        batch.update(doc.ref, { status: "expired" });
        expiredCount++;
      }
    });

    if (expiredCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, expired: expiredCount });
  } catch (error) {
    console.error("만료 처리 오류:", error);
    return NextResponse.json({ success: false, error: String(error) });
  }
}
