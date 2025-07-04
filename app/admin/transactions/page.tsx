"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  getDocs,
  query,
  orderBy,
  doc,
  updateDoc,
  increment,
  getDoc,
} from "firebase/firestore";

export default function AdminTransactionsPage() {
  const [transactions, setTransactions] = useState<any[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      const chargesSnap = await getDocs(query(collection(db, "chargeRequests"), orderBy("createdAt", "desc")));
      const withdrawsSnap = await getDocs(query(collection(db, "withdrawRequests"), orderBy("createdAt", "desc")));

      const charges = chargesSnap.docs.map(docSnap => ({
        id: docSnap.id,
        type: "charge",
        amount: docSnap.data().amount,
        status: docSnap.data().status,
        uid: docSnap.data().uid,
        depositorName: docSnap.data().depositorName,
        createdAt: docSnap.data().createdAt?.toDate().toLocaleString() ?? "",
      }));

      const withdraws = withdrawsSnap.docs.map(docSnap => ({
        id: docSnap.id,
        type: "withdraw",
        amount: docSnap.data().amount,
        status: docSnap.data().status,
        uid: docSnap.data().uid,
        bankName: docSnap.data().bankName,
        accountNumber: docSnap.data().accountNumber,
        holderName: docSnap.data().holderName,
        createdAt: docSnap.data().createdAt?.toDate().toLocaleString() ?? "",
      }));

      setTransactions([...charges, ...withdraws]);
    };

    fetchData();
  }, []);

  const handleApprove = async (t: any) => {
    if (!confirm("해당 요청을 승인 처리하시겠습니까?")) return;
    const userBalanceRef = doc(db, "balances", t.uid);
    const requestRef = doc(db, t.type === "charge" ? "chargeRequests" : "withdrawRequests", t.id);

    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists() && requestSnap.data().status !== "pending") {
      alert("이미 처리된 요청입니다.");
      return;
    }

    // 잔액 처리
    if (t.type === "charge") {
      await updateDoc(userBalanceRef, {
        amount: increment(t.amount),
      });
    } else if (t.type === "withdraw") {
      await updateDoc(userBalanceRef, {
        amount: increment(-t.amount),
      });
    }

    // 상태 업데이트
    await updateDoc(requestRef, { status: "approved" });

    alert("승인 처리 완료");
    location.reload();
  };

  const handleReject = async (t: any) => {
    if (!confirm("해당 요청을 반려 처리하시겠습니까?")) return;
    const requestRef = doc(db, t.type === "charge" ? "chargeRequests" : "withdrawRequests", t.id);

    const requestSnap = await getDoc(requestRef);
    if (requestSnap.exists() && requestSnap.data().status !== "pending") {
      alert("이미 처리된 요청입니다.");
      return;
    }

    await updateDoc(requestRef, { status: "rejected" });
    alert("반려 처리 완료");
    location.reload();
  };

  const filtered = transactions.filter(t => {
    const matchesType = typeFilter ? t.type === typeFilter : true;
    const matchesStatus = statusFilter ? t.status === statusFilter : true;
    const matchesSearch =
      searchTerm.trim() === "" ||
      t.uid.includes(searchTerm.trim());
    return matchesType && matchesStatus && matchesSearch;
  });

  const approvedSum = filtered.filter(t => t.status === "approved").reduce((acc, cur) => acc + cur.amount, 0);
  const pendingSum = filtered.filter(t => t.status === "pending").reduce((acc, cur) => acc + cur.amount, 0);
  const rejectedSum = filtered.filter(t => t.status === "rejected").reduce((acc, cur) => acc + cur.amount, 0);

  const downloadCSV = () => {
    const header = "ID,Type,UID,Amount,Status,CreatedAt\n";
    const rows = filtered.map(t =>
      `${t.id},${t.type},${t.uid},${t.amount},${t.status},${t.createdAt}`
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
      <h1 className="text-lg font-bold">💼 관리자 거래 관리 및 승인</h1>

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
          placeholder="사용자 UID 검색"
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
              <th className="border px-2 py-1">UID</th>
              <th className="border px-2 py-1">신청시간</th>
              <th className="border px-2 py-1">관리</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="text-center">
                <td className="border px-2 py-1 text-xs break-all">{t.id}</td>
                <td className="border px-2 py-1">{t.type}</td>
                <td className="border px-2 py-1">{t.amount.toLocaleString()}</td>
                <td className="border px-2 py-1">{t.status}</td>
                <td className="border px-2 py-1 text-xs break-all">{t.uid}</td>
                <td className="border px-2 py-1">{t.createdAt}</td>
                <td className="border px-2 py-1 space-y-1 flex flex-col">
                  <button
                    disabled={t.status !== "pending"}
                    onClick={() => handleApprove(t)}
                    className={`text-xs rounded p-1 ${t.status !== "pending" ? "bg-gray-300" : "bg-green-500 text-white"}`}
                  >
                    승인
                  </button>
                  <button
                    disabled={t.status !== "pending"}
                    onClick={() => handleReject(t)}
                    className={`text-xs rounded p-1 ${t.status !== "pending" ? "bg-gray-300" : "bg-red-500 text-white"}`}
                  >
                    반려
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
