"use client";

import { useDashboardApplications } from "@/lib/hooks/useDashboardApplications";
import { formatApplicationLine } from "@/lib/utils/formatApplicationLine";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function SellerDashboard() {
  const { applications, message, handleParticipate } = useDashboardApplications("seller");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) return <p className="p-4">로딩 중...</p>;

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-2">📜 판매자 거래목록</h1>
      {message && <p className="text-red-500">{message}</p>}
      {applications.length === 0 && <p>표시할 거래가 없습니다.</p>}

      {applications.map((app) => (
        <div key={app.id} className="border p-2 rounded mb-2">
          <p>{formatApplicationLine(app)}</p>
          {app.status === "진행중" ? (
            <p className="text-green-600 mt-2 font-semibold">✅ 거래 진행 중</p>
          ) : (
            <button
              onClick={() => handleParticipate(app.id)}
              className="bg-blue-500 text-white p-1 rounded mt-2 w-full"
            >
              판매하기
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
