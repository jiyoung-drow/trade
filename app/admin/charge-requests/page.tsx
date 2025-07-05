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

export default function ChargeRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "chargeRequests"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setRequests(data);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleApprove = async (request: any) => {
    if (!confirm(`충전 신청 ${request.amount.toLocaleString()}원을 승인하시겠습니까?`)) return;

    const balanceRef = doc(db, "balances", request.uid);
    const requestRef = doc(db, "chargeRequests", request.id);

    await updateDoc(balanceRef, {
      amount: increment(request.amount),
    });

    await updateDoc(requestRef, {
      status: "승인완료",
      approvedAt: serverTimestamp(),
    });

    alert("충전 승인 완료되었습니다.");
  };

  if (loading) return <p className="p-4">로딩 중...</p>;

  return (
    <div className="max-w-lg mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">💰 충전 신청 관리</h1>
      {requests.length === 0 ? (
        <p className="text-gray-600">충전 신청 내역이 없습니다.</p>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="border rounded p-4 space-y-1">
            <p>UID: {req.uid}</p>
            <p>금액: {req.amount.toLocaleString()}원</p>
            <p>상태: {req.status}</p>
            <button
              onClick={() => handleApprove(req)}
              disabled={req.status === "승인완료"}
              className={`w-full rounded p-2 mt-2 ${
                req.status === "승인완료"
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-green-600 text-white"
              }`}
            >
              {req.status === "승인완료" ? "승인 완료" : "승인하기"}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
