"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
  getDoc,
  where,
  Timestamp,
  runTransaction, // runTransaction import 추가
} from "firebase/firestore";

// TopUpRequest 인터페이스 정의 (topUpRequests 컬렉션 문서 구조에 맞춤)
interface TopUpRequest {
  id: string;
  uid: string; // 충전을 요청한 사용자 UID
  email: string; // 충전을 요청한 사용자 이메일
  amount: number; // 충전 요청 금액
  senderName?: string; // 입금자명 (선택 사항)
  status: "pending" | "approved" | "rejected"; // 요청 상태
  requestedAt: Timestamp; // 요청 시간
  adminBankInfoAtRequest?: { // 요청 시점의 관리자 계좌 정보 (선택 사항)
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  approvedBy?: string; // 승인한 관리자 이메일
  approvedAt?: Timestamp; // 승인 시간
  rejectedBy?: string; // 거절한 관리자 이메일
  rejectedAt?: Timestamp; // 거절 시간
}

export default function AdminChargePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [topUpRequests, setTopUpRequests] = useState<TopUpRequest[]>([]); // 이름 변경: transactions -> topUpRequests
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [filterStatus, setFilterStatus] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");
  const [sortKey, setSortKey] = useState<"requestedAt" | "amount">("requestedAt"); // sortKey 변경: createdAt -> requestedAt
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

  // 충전 요청 목록 불러오기 및 실시간 업데이트
  useEffect(() => {
    if (!isAdmin) return; // 관리자가 아니면 데이터 불러오지 않음

    // ⭐ transactions 컬렉션 대신 topUpRequests 컬렉션 사용 ⭐
    const q = query(
      collection(db, "topUpRequests"),
      orderBy(sortKey, sortOrder)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: TopUpRequest[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          uid: d.uid,
          email: d.email,
          amount: d.amount,
          senderName: d.senderName,
          status: d.status,
          requestedAt: d.requestedAt,
          adminBankInfoAtRequest: d.adminBankInfoAtRequest,
          approvedBy: d.approvedBy,
          approvedAt: d.approvedAt,
          rejectedBy: d.rejectedBy,
          rejectedAt: d.rejectedAt,
        };
      });
      setTopUpRequests(data); // 상태 이름 변경
    }, (error) => {
        console.error("충전 요청 불러오기 오류:", error);
        alert("충전 요청 목록을 불러오는 데 실패했습니다.");
    });

    return () => unsubscribe();
  }, [isAdmin, sortKey, sortOrder]);

  // 충전 요청 승인 처리
  const handleApprove = async (request: TopUpRequest) => { // 매개변수 이름 변경: tx -> request
    if (request.status !== "pending") {
      alert("이미 처리된 신청입니다.");
      return;
    }

    try {
      await runTransaction(db, async (transaction) => {
        // 1. 사용자 잔액 업데이트
        const userRef = doc(db, "users", request.uid);
        transaction.update(userRef, {
          balance: increment(request.amount),
        });

        // 2. topUpRequests 문서 상태 업데이트
        const topUpRequestRef = doc(db, "topUpRequests", request.id);
        transaction.update(topUpRequestRef, {
          status: "approved",
          approvedBy: session?.user?.email || "admin",
          approvedAt: serverTimestamp(),
        });

        // ⭐ 3. transactions 컬렉션에 'charge' 타입의 거래 기록 추가 ⭐
        // 이 기록은 사용자의 '내 거래 기록' 페이지에 표시됩니다.
        const transactionsCollectionRef = collection(db, "transactions");
        transaction.set(doc(transactionsCollectionRef), {
          uid: request.uid,
          type: "charge", // "charge" 타입으로 기록
          amount: request.amount,
          timestamp: serverTimestamp(),
          description: `보유 금액 충전: ${request.amount.toLocaleString()}원`,
          relatedRequestId: request.id, // topUpRequest 문서 ID 참조 (선택 사항)
        });
      });

      alert("✅ 충전 요청이 승인되고 사용자 잔액이 업데이트되었습니다.");
    } catch (error: any) {
      console.error("충전 승인 오류:", error);
      alert(`충전 승인 중 오류가 발생했습니다: ${error.message || error}`);
    }
  };

  // 충전 요청 거절 처리
  const handleReject = async (request: TopUpRequest) => { // 매개변수 이름 변경: tx -> request
    if (request.status !== "pending") {
      alert("이미 처리된 신청입니다.");
      return;
    }

    try {
      // topUpRequests 문서 상태만 업데이트 (잔액 변경 없음)
      await updateDoc(doc(db, "topUpRequests", request.id), {
        status: "rejected",
        rejectedBy: session?.user?.email || "admin",
        rejectedAt: serverTimestamp(),
      });

      alert("❌ 충전 요청이 거절 처리되었습니다.");
    } catch (error) {
      console.error("충전 거절 오류:", error);
      alert("충전 거절 중 오류가 발생했습니다.");
    }
  };

  // 필터링된 요청 목록
  const filteredRequests = topUpRequests.filter((request) => { // 이름 변경: filtered -> filteredRequests
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
      <h1 className="text-2xl font-bold text-center mb-4">💳 충전 요청 관리</h1>

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
            <option value="requestedAt">날짜순</option> {/* 변경 */}
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

      {filteredRequests.length === 0 ? ( // 이름 변경
        <p className="text-center text-gray-500">충전 요청 내역이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {filteredRequests.map((request) => ( // 이름 변경
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
                    {request.amount.toLocaleString()}원 충전 요청
                  </p>
                  <p className="text-sm text-gray-500">
                    입금자명:{" "}
                    <span className="font-medium">
                      {request.senderName ?? "입력되지 않음"}
                    </span>
                  </p>
                  <p className="text-sm text-gray-500">
                    사용자 ID:{" "}
                    <span className="font-mono bg-gray-100 px-1 rounded">
                      {request.uid}
                    </span>
                  </p>
                  <p className="text-sm text-gray-600">상태: {request.status}</p>
                  <p className="text-sm text-gray-500">
                    요청일: {request.requestedAt?.toDate().toLocaleString()}
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
