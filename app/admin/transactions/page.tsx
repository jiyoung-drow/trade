"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const chargesSnap = await getDocs(query(collection(db, "chargeRequests"), orderBy("requestedAt", "desc")));
      const withdrawsSnap = await getDocs(query(collection(db, "withdrawRequests"), orderBy("requestedAt", "desc")));

      const charges = chargesSnap.docs.map(doc => ({
        id: doc.id,
        type: "charge",
        amount: doc.data().amount,
        status: doc.data().status,
        userId: doc.data().userId,
        createdAt: doc.data().requestedAt?.toDate().toLocaleString() ?? "",
      }));

      const withdraws = withdrawsSnap.docs.map(doc => ({
        id: doc.id,
        type: "withdraw",
        amount: doc.data().amount,
        status: doc.data().status,
        userId: doc.data().userId,
        createdAt: doc.data().requestedAt?.toDate().toLocaleString() ?? "",
      }));

      setTransactions([...charges, ...withdraws]);
    };

    fetchData();
  }, []);

  const filtered = transactions.filter(t => {
    const matchesType = typeFilter ? t.type === typeFilter : true;
    const matchesStatus = statusFilter ? t.status === statusFilter : true;
    const matchesSearch =
      searchTerm.trim() === "" ||
      t.userId.includes(searchTerm.trim());
    return matchesType && matchesStatus && matchesSearch;
  });

  const approvedSum = filtered.filter(t => t.status === "approved").reduce((acc, cur) => acc + cur.amount, 0);
  const pendingSum = filtered.filter(t => t.status === "pending").reduce((acc, cur) => acc + cur.amount, 0);
  const rejectedSum = filtered.filter(t => t.status === "rejected").reduce((acc, cur) => acc + cur.amount, 0);

  const downloadCSV = () => {
    const header = "ID,Type,UserID,Amount,Status,CreatedAt\n";
    const rows = filtered.map(t =>
      `${t.id},${t.type},${t.userId},${t.amount},${t.status},${t.createdAt}`
    ).join("\n");

    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "transactions.csv";
    a.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="p-4 max-w-5xl mx-auto space-y-4">
      <h1 className="text-lg font-bold">💼 관리자 거래 관리 및 통계</h1>

      <div className="border p-3 rounded bg-gray-50 space-y-1">
        <p>✅ 승인 합계: {approvedSum} 원</p>
        <p>⏳ 대기 합계: {pendingSum} 원</p>
        <p>❌ 반려 합계: {rejectedSum} 원</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="border p-2 rounded flex-1"
        >
          <option value="">거래 타입 전체</option>
          <option value="charge">충전</option>
          <option value="withdraw">출금</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border p-2 rounded flex-1"
        >
          <option value="">상태 전체</option>
          <option value="pending">대기</option>
          <option value="approved">승인</option>
          <option value="rejected">반려</option>
        </select>
        <input
          type="text"
          placeholder="사용자 ID 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border p-2 rounded flex-1"
        />
        <button
          onClick={downloadCSV}
          className="bg-green-600 text-white px-4 py-2 rounded w-full sm:w-auto"
        >
          CSV 다운로드
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border mt-2 text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-2 py-1">ID</th>
              <th className="border px-2 py-1">타입</th>
              <th className="border px-2 py-1">금액</th>
              <th className="border px-2 py-1">상태</th>
              <th className="border px-2 py-1">사용자ID</th>
              <th className="border px-2 py-1">신청시간</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="text-center">
                <td className="border px-2 py-1 text-xs">{t.id}</td>
                <td className="border px-2 py-1">{t.type}</td>
                <td className="border px-2 py-1">{t.amount}</td>
                <td className="border px-2 py-1">{t.status}</td>
                <td className="border px-2 py-1">{t.userId}</td>
                <td className="border px-2 py-1">{t.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
