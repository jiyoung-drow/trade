"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
  getDoc,
  Timestamp,
  runTransaction, // runTransaction import 추가
} from "firebase/firestore";

// Transaction 인터페이스 정의 (출금 요청에 필요한 필드 추가)
interface Transaction {
  id: string;
  uid: string; // 출금을 요청한 사용자 UID
  type: "charge" | "withdraw"; // 거래 유형
  amount: number; // 거래 금액
  status: "pending" | "approved" | "rejected"; // 요청 상태
  createdAt: Timestamp; // 요청 생성 시각 (기존 필드)
  
  // 출금 요청에 특화된 필드 추가
  recipientBankName?: string; // 수령 은행명
  recipientAccountNumber?: string; // 수령 계좌번호
  recipientAccountHolder?: string; // 수령 예금주

  // 관리자 처리 관련 필드
  approvedBy?: string;
  approvedAt?: Timestamp;
  rejectedBy?: string;
  rejectedAt?: Timestamp;
}

export default function AdminWithdrawPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [withdrawRequests, setWithdrawRequests] = useState<Transaction[]>([]); // 상태 이름 변경: transactions -> withdrawRequests
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [sortKey, setSortKey] = useState<"createdAt" | "amount">("createdAt");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // 관리자 권한 확인 로직
  useEffect(() => {
    const checkAdmin = async () => {
      if (status === "loading") return; // 세션 로딩 중에는 아무것도 하지 않음

      if (!session?.user?.id) {
        // 로그인되지 않은 경우, 로그인 페이지로 리다이렉트
        alert("로그인이 필요합니다.");
        router.push("/auth/signin");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", session.user.id));
        const role = userDoc.data()?.role;
        if (role === "admin") {
          setIsAdmin(true);
        } else {
          alert("관리자만 접근 가능합니다.");
          router.push("/"); // 관리자가 아니면 홈으로 리다이렉트
        }
      } catch (error) {
        console.error("관리자 권한 확인 오류:", error);
        alert("관리자 권한 확인 중 오류가 발생했습니다.");
        router.push("/"); // 오류 발생 시에도 홈으로 리다이렉트
      }
    };
    if (status === "authenticated") {
        checkAdmin();
    } else if (status === "unauthenticated") {
        // 인증되지 않은 상태면 바로 로그인 페이지로
        router.push("/auth/signin");
    }
  }, [session, status, router]);

  // 출금 요청 목록 불러오기 및 실시간 업데이트
  useEffect(() => {
    if (!isAdmin) return;

    const q = query(
      collection(db, "transactions"), // transactions 컬렉션에서 가져옴
      where("type", "==", "withdraw"), // type이 "withdraw"인 문서만 필터링
      orderBy(sortKey, sortOrder)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Transaction[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          uid: d.uid,
          type: d.type,
          amount: d.amount,
          status: d.status,
          createdAt: d.createdAt,
          recipientBankName: d.recipientBankName, // 추가된 필드
          recipientAccountNumber: d.recipientAccountNumber, // 추가된 필드
          recipientAccountHolder: d.recipientAccountHolder, // 추가된 필드
          approvedBy: d.approvedBy,
          approvedAt: d.approvedAt,
          rejectedBy: d.rejectedBy,
          rejectedAt: d.rejectedAt,
        };
      });
      setWithdrawRequests(data); // 상태 이름 변경
    }, (error) => {
        console.error("출금 요청 불러오기 오류:", error);
        alert("출금 요청 목록을 불러오는 데 실패했습니다.");
    });

    return () => unsubscribe();
  }, [isAdmin, sortKey, sortOrder]);

  // 출금 요청 승인 처리
  const handleApprove = async (request: Transaction) => { // 매개변수 이름 변경: tx -> request
    if (request.status !== "pending") {
      alert("이미 처리된 신청입니다.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        const userRef = doc(db, "users", request.uid);
        const userSnap = await transaction.get(userRef); // 트랜잭션 내에서 문서 가져오기

        if (!userSnap.exists()) {
          throw new Error("사용자 정보를 찾을 수 없습니다.");
        }
        const currentBalance = userSnap.data()?.balance ?? 0;

        // 보유 금액 부족 체크
        if (request.amount > currentBalance) {
          throw new Error("보유 금액이 부족하여 출금을 승인할 수 없습니다.");
        }

        // 1. 사용자 잔액 차감
        transaction.update(userRef, {
          balance: increment(-request.amount),
        });

        // 2. transactions 문서 상태 업데이트 (출금 요청 문서 자체를 업데이트)
        const transactionDocRef = doc(db, "transactions", request.id);
        transaction.update(transactionDocRef, {
          status: "approved",
          approvedBy: session?.user?.email || "admin",
          approvedAt: serverTimestamp(),
        });
      });

      alert("✅ 출금 승인 완료되었습니다. 사용자 잔액이 차감되었습니다.");
    } catch (error: any) {
      console.error("출금 승인 오류:", error);
      alert(`출금 승인 중 오류가 발생했습니다: ${error.message || error}`);
    }
  };

  // 출금 요청 거절 처리
  const handleReject = async (request: Transaction) => { // 매개변수 이름 변경: tx -> request
    if (request.status !== "pending") {
      alert("이미 처리된 신청입니다.");
      return;
    }

    try {
      // transactions 문서 상태만 업데이트 (잔액 변경 없음)
      await updateDoc(doc(db, "transactions", request.id), {
        status: "rejected",
        rejectedBy: session?.user?.email || "admin",
        rejectedAt: serverTimestamp(),
      });

      alert("❌ 출금 요청이 거절 처리되었습니다.");
    } catch (error) {
      console.error("출금 거절 오류:", error);
      alert("출금 거절 중 오류가 발생했습니다.");
    }
  };

  // 필터링된 요청 목록
  const filteredRequests = withdrawRequests.filter((request) => { // 이름 변경: filtered -> filteredRequests
    return filterStatus === "all" || request.status === filterStatus;
  });

  if (status === "loading" || isAdmin === null) {
    return <div className="p-4 text-center">로딩 중...</div>;
  }

  if (!isAdmin) {
    return <div className="p-4 text-center">접근 권한이 없습니다.</div>;
  }

  return (
    <main className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-center mb-4">💸 출금 요청 관리</h1>

      <div className="flex flex-wrap gap-2 mb-4 justify-between items-center">
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="border p-2 rounded"
        >
          <option value="all">전체 상태</option>
          <option value="pending">대기</option>
          <option value="approved">승인</option>
          <option value="rejected">거절</option>
        </select>
        <div className="flex gap-2">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as any)}
            className="border p-2 rounded"
          >
            <option value="createdAt">날짜순</option>
            <option value="amount">금액순</option>
          </select>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as any)}
            className="border p-2 rounded"
          >
            <option value="desc">내림차순</option>
            <option value="asc">오름차순</option>
          </select>
        </div>
      </div>

      {filteredRequests.length === 0 ? (
        <p className="text-center text-gray-500">출금 요청 내역이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {filteredRequests.map((request) => (
            <li
              key={request.id}
              className={`p-4 rounded shadow border ${
                request.status === "approved"
                  ? "bg-green-50 border-green-200"
                  : request.status === "rejected"
                  ? "bg-red-50 border-red-200"
                  : "bg-white"
              }`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-semibold">
                    {request.amount.toLocaleString()}원 출금 요청
                  </p>
                  <p className="text-sm text-gray-500">
                    사용자 ID:{" "}
                    <span className="font-mono bg-gray-100 px-1 rounded">
                      {request.uid}
                    </span>
                  </p>
                  {/* 출금 요청에 특화된 정보 표시 */}
                  {request.recipientBankName && (
                    <p className="text-sm text-gray-500">
                      은행: <span className="font-medium">{request.recipientBankName}</span>
                    </p>
                  )}
                  {request.recipientAccountNumber && (
                    <p className="text-sm text-gray-500">
                      계좌: <span className="font-medium">{request.recipientAccountNumber}</span>
                    </p>
                  )}
                  {request.recipientAccountHolder && (
                    <p className="text-sm text-gray-500">
                      예금주: <span className="font-medium">{request.recipientAccountHolder}</span>
                    </p>
                  )}
                  <p className="text-sm text-gray-600">상태: {request.status}</p>
                  <p className="text-sm text-gray-500">
                    요청일: {request.createdAt?.toDate().toLocaleString()}
                  </p>
                </div>
                {request.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(request)}
                      className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm"
                    >
                      승인
                    </button>
                    <button
                      onClick={() => handleReject(request)}
                      className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                    >
                      거절
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
