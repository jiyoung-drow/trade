import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";
import { getServerSession } from "next-auth";
import { auth } from "@/lib/firebase";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { requestId } = await req.json();

    if (!requestId) {
      return NextResponse.json({ error: "Missing requestId" }, { status: 400 });
    }

    const requestRef = doc(db, "requests", requestId);
    const requestSnap = await getDoc(requestRef);

    if (!requestSnap.exists()) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const requestData = requestSnap.data();
    if (requestData.status !== "pending") {
      return NextResponse.json({ error: "Request is not pending" }, { status: 400 });
    }

    // 거절 처리
    await updateDoc(requestRef, {
      status: "rejected",
      processedAt: serverTimestamp(),
      adminId: session.user.id,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error rejecting request:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
