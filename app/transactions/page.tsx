"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { collection, query, where, orderBy, getDocs, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase"; // Firebase Firestore 인스턴스
import TabBar from "@/components/TabBar"; // TabBar 컴포넌트 (필요하다면)

interface Transaction {
  id: string;
  uid: string; // 거래를 발생시킨 사용자 UID
  type: "deduction" | "return" | "deposit" | "settlement"; // 거래 유형 (차감, 반환, 입금, 정산 등)
  amount: number; // 거래 금액
  timestamp: Timestamp; // 거래 발생 시각
  description?: string; // 거래 상세 설명
  // 필요에 따라 추가 필드 정의
}

export default function TransactionsPage() {
  const { data: session, status } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTransactions = async () => {
      if (status === "loading" || !session?.user?.id) {
        // 세션 로딩 중이거나 사용자 ID가 없으면 데이터 가져오기 중단
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const transactionsRef = collection(db, "transactions");
        // 현재 로그인한 사용자의 거래 내역만 가져옵니다.
        // 시간순으로 정렬 (가장 최신 거래가 먼저 오도록)
        const q = query(
          transactionsRef,
          where("uid", "==", session.user.id),
          orderBy("timestamp", "desc")
        );

        const querySnapshot = await getDocs(q);
        const fetchedTransactions: Transaction[] = [];
        querySnapshot.forEach((doc) => {
          fetchedTransactions.push({ id: doc.id, ...doc.data() } as Transaction);
        });
        setTransactions(fetchedTransactions);
      } catch (err) {
        console.error("거래 내역을 불러오는 중 오류 발생:", err);
        setError("거래 내역을 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [session?.user?.id, status]); // 사용자 세션 정보 변경 시 다시 불러오기

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
      <TabBar /> {/* 상단 탭 바 컴포넌트 */}
      <div className="max-w-md mx-auto p-4 pt-8 pb-20 font-sans">
        <h1 className="text-2xl font-bold text-center text-green-600 mb-6">
          내 거래 기록 📊
        </h1>

        {transactions.length === 0 ? (
          <p className="text-center text-gray-600">아직 거래 내역이 없습니다.</p>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="border-b border-gray-100 py-3 last:border-b-0">
                <div className="flex justify-between items-center">
                  <p className="text-gray-800 font-semibold">
                    {transaction.type === "deduction" && "금액 차감"}
                    {transaction.type === "return" && "금액 반환"}
                    {transaction.type === "deposit" && "입금"}
                    {transaction.type === "settlement" && "정산"}
                    {/* 다른 유형 추가 */}
                  </p>
                  <p className={`font-bold ${transaction.type === "deduction" ? "text-red-600" : "text-green-600"}`}>
                    {transaction.type === "deduction" ? "-" : "+"} {transaction.amount.toLocaleString()}원
                  </p>
                </div>
                <p className="text-sm text-gray-500">
                  {transaction.description && `(${transaction.description}) `}
                  {transaction.timestamp?.toDate().toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
