"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  orderBy,
  getDocs,
  deleteDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import TabBar from "@/components/TabBar";

// 거래 내역 데이터의 타입 정의
interface Transaction {
  id: string;
  uid?: string; // 구매자 UID
  type: "deduction" | "return" | "deposit" | "settlement"; // 거래 유형
  amount: number;
  timestamp: Timestamp;
  description?: string;
  applicationId?: string;
}

export default function AdminTransactionsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // 💡 여러 개 삭제를 위해 추가된 상태: 선택된 거래 기록의 ID를 저장하는 배열
  const [selectedTransactionIds, setSelectedTransactionIds] = useState<string[]>([]);

  // 관리자 권한 확인 및 데이터 불러오기
  useEffect(() => {
    const fetchAdminStatusAndTransactions = async () => {
      if (status === "loading" || !session?.user?.id) {
        setLoading(false);
        return;
      }

      const isAdmin = true; // TODO: 실제 관리자 권한 확인 로직으로 교체하세요.

      if (!isAdmin) {
        setError("관리자만 접근할 수 있는 페이지입니다.");
        setLoading(false);
        router.push("/");
        return;
      }

      setLoading(true);
      try {
        const transactionsRef = collection(db, "transactions");
        const q = query(transactionsRef, orderBy("timestamp", "desc"));
        const querySnapshot = await getDocs(q);

        const fetchedTransactions: Transaction[] = [];
        querySnapshot.forEach((doc) => {
          fetchedTransactions.push({
            id: doc.id,
            ...doc.data(),
          } as Transaction);
        });
        setTransactions(fetchedTransactions);
      } catch (err) {
        console.error("거래 내역을 불러오는 중 오류 발생:", err);
        setError("거래 내역을 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStatusAndTransactions();
  }, [session, status, router]);

  // 💡 체크박스 상태를 관리하는 함수
  const handleCheckboxChange = (transactionId: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedTransactionIds((prev) => [...prev, transactionId]);
    } else {
      setSelectedTransactionIds((prev) =>
        prev.filter((id) => id !== transactionId)
      );
    }
  };

  // 💡 선택된 모든 거래 기록을 삭제하는 함수
  const handleDeleteSelectedTransactions = async () => {
    if (selectedTransactionIds.length === 0) {
      alert("삭제할 항목을 선택해 주세요.");
      return;
    }

    if (!window.confirm(`선택된 ${selectedTransactionIds.length}개의 거래 기록을 정말로 삭제하시겠습니까?`)) {
      return;
    }

    try {
      const deletionPromises = selectedTransactionIds.map((id) =>
        deleteDoc(doc(db, "transactions", id))
      );
      await Promise.all(deletionPromises);
      
      // 삭제 후 UI 업데이트: 삭제된 항목 제외하고 목록 갱신
      setTransactions((prev) =>
        prev.filter((transaction) => !selectedTransactionIds.includes(transaction.id))
      );
      // 선택 목록 초기화
      setSelectedTransactionIds([]);
      alert("선택된 거래 기록이 성공적으로 삭제되었습니다.");
    } catch (err) {
      console.error("거래 기록 삭제 중 오류 발생:", err);
      alert("거래 기록 삭제에 실패했습니다.");
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        거래 내역 로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen text-red-500">
        오류: {error}
      </div>
    );
  }

  return (
    <>
      <TabBar />
      <div className="max-w-4xl mx-auto p-4 pt-8 pb-20 font-sans">
        <h1 className="text-2xl font-bold text-center text-indigo-600 mb-6">
          관리자 거래 기록 📊
        </h1>
        
        {/* 💡 선택 삭제 버튼 */}
        {transactions.length > 0 && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={handleDeleteSelectedTransactions}
              className="bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg shadow-md disabled:bg-gray-400 disabled:cursor-not-allowed"
              disabled={selectedTransactionIds.length === 0}
            >
              선택 항목 삭제 ({selectedTransactionIds.length})
            </button>
          </div>
        )}

        {transactions.length === 0 ? (
          <p className="text-center text-gray-600">
            표시할 거래 내역이 없습니다.
          </p>
        ) : (
          <div className="bg-white rounded-lg shadow-lg border border-gray-200 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {/* 💡 체크박스 열 */}
                  <th scope="col" className="w-12 px-2 py-3">
                    <input
                      type="checkbox"
                      className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedTransactionIds(transactions.map((t) => t.id));
                        } else {
                          setSelectedTransactionIds([]);
                        }
                      }}
                      checked={
                        selectedTransactionIds.length === transactions.length &&
                        transactions.length > 0
                      }
                    />
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    거래 ID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    UID
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    유형
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    금액
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    설명
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    날짜
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((transaction) => (
                  <tr key={transaction.id}>
                    {/* 💡 개별 체크박스 */}
                    <td className="w-12 px-2 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        className="form-checkbox h-4 w-4 text-indigo-600 transition duration-150 ease-in-out"
                        checked={selectedTransactionIds.includes(transaction.id)}
                        onChange={(e) =>
                          handleCheckboxChange(transaction.id, e.target.checked)
                        }
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="font-mono text-xs">
                        {transaction.id.substring(0, 8)}...
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.uid?.substring(0, 8)}...
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.type}
                    </td>
                    <td
                      className={`px-6 py-4 whitespace-nowrap text-sm font-semibold ${
                        transaction.type === "deduction"
                          ? "text-red-600"
                          : "text-green-600"
                      }`}
                    >
                      {transaction.amount.toLocaleString()}원
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-sm overflow-hidden text-ellipsis whitespace-nowrap">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.timestamp?.toDate().toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}