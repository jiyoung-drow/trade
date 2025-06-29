"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  getDoc,
  setDoc,
} from "firebase/firestore";

interface Withdraw {
  id: string;
  userId: string;
  amount: number;
  status: string;
}

export default function AdminPage() {
  const [withdraws, setWithdraws] = useState<Withdraw[]>([]);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "withdrawRequests"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        userId: doc.data().userId,
        amount: doc.data().amount,
        status: doc.data().status,
      }));
      setWithdraws(data);
    });
    return () => unsub();
  }, []);

  const approveWithdraw = async (w: Withdraw) => {
    try {
      setLoadingId(w.id);

      const withdrawRef = doc(db, "withdrawRequests", w.id);
      const userRef = doc(db, "users", w.userId);
      const feeRef = doc(db, "platform", "fee");

      const fee = Math.floor(w.amount * 0.05);
      const netAmount = w.amount - fee;

      // 사용자 문서 없으면 생성
      const userSnap = await getDoc(userRef);
      if (!userSnap.exists()) {
        await setDoc(userRef, { balance: 0, role: "seller" });
      }

      // 사용자 balance 차감
      await updateDoc(userRef, { balance: increment(-w.amount) });

      // 출금 상태 승인으로 변경
      await updateDoc(withdrawRef, { status: "approved" });

      // fee 문서 없으면 생성
      const feeSnap = await getDoc(feeRef);
      if (!feeSnap.exists()) {
        await setDoc(feeRef, { totalFee: fee });
      } else {
        await updateDoc(feeRef, { totalFee: increment(fee) });
      }

      alert(`✅ 승인 완료\n수수료: ${fee}원\n실수령액: ${netAmount}원`);
    } catch (error) {
      console.error("출금 승인 오류:", error);
      alert("❌ 승인 중 오류가 발생했습니다. 콘솔 로그를 확인하세요.");
    } finally {
      setLoadingId(null);
    }
  };

  const rejectWithdraw = async (w: Withdraw) => {
    try {
      setLoadingId(w.id);
      const withdrawRef = doc(db, "withdrawRequests", w.id);
      await updateDoc(withdrawRef, { status: "rejected" });
      alert("🚫 출금 요청이 반려되었습니다.");
    } catch (error) {
      console.error("출금 반려 오류:", error);
      alert("❌ 반려 처리 중 오류가 발생했습니다.");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <main className="p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold">💼 관리자 출금 승인/반려 페이지</h1>

      {withdraws.length === 0 && <p>출금 요청 내역이 없습니다.</p>}

      {withdraws.map((w) => (
        <div
          key={w.id}
          className="border p-4 rounded flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
        >
          <div>
            <p>💸 금액: {w.amount} 원</p>
            <p>🆔 사용자 ID: {w.userId}</p>
            <p>📌 상태: {w.status}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => approveWithdraw(w)}
              disabled={w.status === "approved" || loadingId === w.id}
              className={`px-3 py-1 rounded text-white ${
                w.status === "approved" || loadingId === w.id
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-green-600"
              }`}
            >
              {loadingId === w.id ? "처리 중..." : "승인"}
            </button>
            <button
              onClick={() => rejectWithdraw(w)}
              disabled={w.status === "rejected" || loadingId === w.id}
              className={`px-3 py-1 rounded text-white ${
                w.status === "rejected" || loadingId === w.id
                  ? "bg-gray-400 cursor-not-allowed"
                  : "bg-red-600"
              }`}
            >
              {loadingId === w.id ? "처리 중..." : "반려"}
            </button>
          </div>
        </div>
      ))}
    </main>
  );
}
