// app/mypage/[id]/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function OrderDetail() {
  const params = useParams();
  const id = params.id as string;
  const [order, setOrder] = useState<any>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      const docRef = doc(db, "orders", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setOrder({ id: docSnap.id, ...docSnap.data() });
      }
    };
    fetchOrder();
  }, [id]);

  const handleStatusChange = async (status: string) => {
    const docRef = doc(db, "orders", id);
    await updateDoc(docRef, { status });
    alert(`상태가 ${status}로 변경되었습니다.`);
  };

  if (!order) return <p className="p-6">로딩 중...</p>;

  return (
    <main className="p-6">
      <h1 className="text-lg mb-4">📝 거래 상세</h1>
      <p>🪪 ID: {order.id}</p>
      <p>💰 원금: {order.amount} 원</p>
      <p>💸 수수료: {order.fee} 원</p>
      <p>📦 상태: {order.status}</p>
      <div className="space-x-2 mt-4">
        <button
          onClick={() => handleStatusChange("approved")}
          className="px-2 py-1 bg-green-600 text-white rounded"
        >
          승인
        </button>
        <button
          onClick={() => handleStatusChange("rejected")}
          className="px-2 py-1 bg-red-600 text-white rounded"
        >
          반려
        </button>
      </div>
    </main>
  );
}
