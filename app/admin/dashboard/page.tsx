"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, getDoc, doc } from "firebase/firestore";
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
    const unsubCharges = onSnapshot(collection(db, "chargeRequests"), (snapshot) => {
      setStats((prev) => ({ ...prev, charges: snapshot.size }));
    });

    const unsubWithdraws = onSnapshot(collection(db, "withdrawRequests"), async (snapshot) => {
      let approved = 0, rejected = 0, pending = 0;
      snapshot.docs.forEach((doc) => {
        const status = doc.data().status;
        if (status === "approved") approved++;
        if (status === "rejected") rejected++;
        if (status === "pending") pending++;
      });

      const feeSnap = await getDoc(doc(db, "platform", "fee"));
      const feeData = feeSnap.exists() ? feeSnap.data().totalFee || 0 : 0;

      setStats((prev) => ({
        ...prev,
        withdraws: snapshot.size,
        approved,
        rejected,
        pending,
        totalFee: feeData,
      }));
    });

    return () => {
      unsubCharges();
      unsubWithdraws();
    };
  }, []);

  const data = {
    labels: ["충전", "출금", "승인", "반려", "대기"],
    datasets: [
      {
        label: "거래 건수",
        data: [stats.charges, stats.withdraws, stats.approved, stats.rejected, stats.pending],
        backgroundColor: "rgba(54, 162, 235, 0.5)",
      },
    ],
  };

  return (
    <main className="p-6 space-y-4 max-w-2xl mx-auto">
      <h1 className="text-lg font-bold">📊 관리자 거래 통계 대시보드</h1>

      <Bar data={data} />

      <div className="border p-4 rounded mt-4">
        <p>💰 누적 수수료: {stats.totalFee} 원</p>
      </div>
    </main>
  );
}
