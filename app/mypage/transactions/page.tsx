"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import TabBar from "@/components/TabBar"; // TabBar 컴포넌트 (필요하다면)

interface Transaction {
  id: string;
  uid: string; // 거래를 발생시킨 사용자 UID
  type: "deduction" | "return" | "deposit" | "settlement" | "charge" | "withdraw"; // 거래 유형 (차감, 반환, 입금, 정산, 충전, 출금)
  amount: number; // 거래 금액
  timestamp: Timestamp; // 거래 발생 시각
  description?: string; // 거래 상세 설명
  // 필요에 따라 추가 필드 정의
}

export default function TransactionsPage() { // 페이지 컴포넌트 이름 변경
  const { data: session, status } = useSession();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 세션 로딩 중이거나 사용자 ID가 없으면 데이터 가져오기 중단
    if (status === "loading" || !session?.user?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // ⭐ requests 컬렉션 대신 transactions 컬렉션에서 데이터를 가져옵니다. ⭐
      const transactionsRef = collection(db, "transactions");
      
      // 현재 로그인한 사용자의 거래 내역만 가져옵니다.
      // 시간순으로 정렬 (가장 최신 거래가 먼저 오도록)
      const q = query(
        transactionsRef,
        where("uid", "==", session.user.id),
        orderBy("timestamp", "desc")
      );

      // 실시간 업데이트를 위해 onSnapshot 사용
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const fetchedTransactions: Transaction[] = [];
          snapshot.docs.forEach((doc) => {
            const data = doc.data();
            fetchedTransactions.push({
              id: doc.id,
              uid: data.uid,
              type: data.type,
              amount: data.amount,
              timestamp: data.timestamp,
              description: data.description,
            } as Transaction);
          });
          setTransactions(fetchedTransactions);
          setLoading(false);
          setError(null); // 오류가 있었다면 초기화
        },
        (error) => {
          console.error("거래 내역을 불러오는 중 오류 발생:", error);
          setError("거래 내역을 불러오는 데 실패했습니다.");
          setLoading(false);
        }
      );

      // 컴포넌트 언마운트 시 구독 해제
      return () => unsubscribe();
    } catch (err) {
      console.error("거래 내역 쿼리 설정 중 오류 발생:", err);
      setError("거래 내역을 불러오는 데 실패했습니다.");
      setLoading(false);
    }
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

  if (!session) {
    return <div className="p-4 text-center">로그인 후 이용해 주세요.</div>;
  }

  return (
    <>
      <TabBar /> {/* 상단 탭 바 컴포넌트 */}
      <div className="max-w-md mx-auto p-4 pt-8 pb-20 font-sans">
        <h1 className="text-2xl font-bold text-center text-green-600 mb-6">
          나의 보유금액 전체 내역 📊
        </h1>

        {transactions.length === 0 ? (
          <p className="text-center text-gray-600">아직 거래 내역이 없습니다.</p>
        ) : (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200">
            {transactions.map((transaction) => (
              <div key={transaction.id} className="border-b border-gray-100 py-3 last:border-b-0">
                <div className="flex justify-between items-center">
                  <p className="text-gray-800 font-semibold">
                    {/* 거래 유형에 따른 표시 */}
                    {transaction.type === "charge" && "충전"}
                    {transaction.type === "withdraw" && "출금"}
                    {transaction.type === "deduction" && "금액 차감"}
                    {transaction.type === "return" && "금액 반환"}
                    {transaction.type === "deposit" && "입금"}
                    {transaction.type === "settlement" && "정산"}
                  </p>
                  <p className={`font-bold ${
                    // 금액 색상 및 부호 조정
                    (transaction.type === "deduction" || transaction.type === "withdraw") ? "text-red-600" : "text-green-600"
                  }`}>
                    {(transaction.type === "deduction" || transaction.type === "withdraw") ? "-" : "+"} {transaction.amount.toLocaleString()}원
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
