import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  updateDoc,
  collection,
  addDoc,
  increment,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    // ✅ 관리자 권한 확인
    if (!session || session.user?.role !== "admin") {
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
      return NextResponse.json(
        { error: "Request is not pending" },
        { status: 400 }
      );
    }

    const { userId, amount, type } = requestData;

    const userBalanceRef = doc(db, "balances", userId);
    const userBalanceSnap = await getDoc(userBalanceRef);

    let currentBalance = 0;

    if (userBalanceSnap.exists()) {
      const balanceData = userBalanceSnap.data();
      currentBalance = balanceData.amount ?? 0;
    } else {
      await setDoc(userBalanceRef, {
        amount: 0,
        updatedAt: serverTimestamp(),
      });
    }

    // ✅ 출금 시 잔액 부족 확인
    if (type === "withdraw" && currentBalance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance for withdrawal" },
        { status: 400 }
      );
    }

    // ✅ 1️⃣ 요청 승인 처리
    await updateDoc(requestRef, {
      status: "approved",
      processedAt: serverTimestamp(),
      adminId: session.user.id ?? "admin",
    });

    // ✅ 2️⃣ transactions 컬렉션 기록
    await addDoc(collection(db, "transactions"), {
      userId,
      amount: type === "charge" ? amount : -amount,
      type,
      createdAt: serverTimestamp(),
      processedBy: session.user.id ?? "admin",
    });

    // ✅ 3️⃣ balances 잔액 갱신
    await updateDoc(userBalanceRef, {
      amount: increment(type === "charge" ? amount : -amount),
      updatedAt: serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error approving request:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
