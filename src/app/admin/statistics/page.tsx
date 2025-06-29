"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

export default function AdminStatisticsPage() {
  const [totalCharges, setTotalCharges] = useState<number>(0);
  const [totalWithdraws, setTotalWithdraws] = useState<number>(0);
  const [totalFee, setTotalFee] = useState<number>(0);

  useEffect(() => {
    const fetchStatistics = async () => {
      const chargeSnap = await getDocs(collection(db, "chargeRequests"));
      const withdrawSnap = await getDocs(collection(db, "withdrawRequests"));
      setTotalCharges(chargeSnap.size);
      setTotalWithdraws(withdrawSnap.size);

      const feeDoc = await getDoc(doc(db, "platform", "fee"));
      if (feeDoc.exists()) {
        const data = feeDoc.data();
        setTotalFee(data.totalFee || 0);
      }
    };
    fetchStatistics();
  }, []);

  return (
    <main className="p-6 space-y-4 max-w-md mx-auto">
      <h1 className="text-lg font-bold">📊 관리자 거래 및 수수료 통계</h1>
      <div className="border p-4 rounded space-y-2">
        <p>💸 총 충전 신청 건수: {totalCharges} 건</p>
        <p>🏦 총 출금 신청 건수: {totalWithdraws} 건</p>
        <p>💰 누적 수수료: {totalFee} 원</p>
      </div>
    </main>
  );
}
