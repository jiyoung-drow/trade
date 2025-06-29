"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { Bar } from "react-chartjs-2";
import { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function AdminDashboardPage() {
  const [stats, setStats] = useState({
    charges: 0,
    withdraws: 0,
    approved: 0,
    rejected: 0,
    pending: 0,
    totalFee: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      const chargeSnap = await getDocs(collection(db, "chargeRequests"));
      const withdrawSnap = await getDocs(collection(db, "withdrawRequests"));

      let approved = 0, rejected = 0, pending = 0;

      withdrawSnap.docs.forEach(doc => {
        const status = doc.data().status;
        if (status === "approved") approved++;
        if (status === "rejected") rejected++;
        if (status === "pending") pending++;
      });

      const feeDoc = await getDoc(doc(db, "platform", "fee"));
      const feeData = feeDoc.exists() ? feeDoc.data().totalFee || 0 : 0;

      setStats({
        charges: chargeSnap.size,
        withdraws: withdrawSnap.size,
        approved,
        rejected,
        pending,
        totalFee: feeData,
      });
    };

    fetchData();
  }, []);

  const data = {
    labels: ["충전 신청", "출금 신청", "승인", "반려", "대기"],
    datasets: [
      {
        label: "거래 건수",
        data: [stats.charges, stats.withdraws, stats.approved, stats.rejected, stats.pending],
        backgroundColor: "rgba(54, 162, 235, 0.6)",
      },
    ],
  };

  return (
    <main className="p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold">📊 관리자 대시보드 (거래 차트 및 수수료 통계)</h1>

      <Bar data={data} />

      <div className="border p-4 rounded mt-4">
        <p>💰 누적 수수료: {stats.totalFee} 원</p>
      </div>
    </main>
  );
}
