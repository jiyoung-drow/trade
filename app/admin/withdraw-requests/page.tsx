"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

export default function WithdrawRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "withdrawRequests"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleApprove = async (request: any) => {
    if (!confirm(`출금 신청 ${request.amount.toLocaleString()}원을 승인하시겠습니까?`)) return;

    const balanceRef = doc(db, "balances", request.uid);
    const requestRef = doc(db, "withdrawRequests", request.id);

    await updateDoc(balanceRef, {
      amount: increment(-request.amount),
    });

    await updateDoc(requestRef, {
      status: "승인완료",
      approvedAt: serverTimestamp(),
    });

    alert("출금 승인 완료되었습니다.");
  };

  const handleReject = async (request: any) => {
    const reason = prompt("거절 사유를 입력하세요:");
    if (!reason) return alert("거절 사유를 입력해야 합니다.");

    const requestRef = doc(db, "withdrawRequests", request.id);

    await updateDoc(requestRef, {
      status: "거절",
      rejectedAt: serverTimestamp(),
      reason,
    });

    alert("출금 요청이 거절 처리되었습니다.");
  };

  if (loading) return <p className="p-4">로딩 중...</p>;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">💸 출금 신청 관리</h1>
      {requests.length === 0 ? (
        <p className="text-gray-600">출금 신청 내역이 없습니다.</p>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="border rounded p-4 space-y-1">
            <p>UID: {req.uid}</p>
            <p>이름: {req.name}</p>
            <p>금액: {req.amount.toLocaleString()}원</p>
            <p>상태: {req.status}</p>
            {req.status === "거절" && <p className="text-red-600">사유: {req.reason}</p>}
            <div className="flex space-x-2 mt-2">
              <button
                onClick={() => handleApprove(req)}
                disabled={req.status === "승인완료"}
                className={`flex-1 rounded p-2 ${
                  req.status === "승인완료"
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-green-600 text-white"
                }`}
              >
                {req.status === "승인완료" ? "승인 완료" : "승인하기"}
              </button>
              <button
                onClick={() => handleReject(req)}
                disabled={req.status === "승인완료" || req.status === "거절"}
                className="flex-1 bg-red-600 text-white rounded p-2"
              >
                거절하기
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
