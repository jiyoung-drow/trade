"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
  confirmNickname,
  rejectNickname,
  checkAndCompleteTransaction,
} from "@/lib/firestore";

// ✅ 타입 안전 보장
interface ApplicationData {
  id: string;
  status?: string;
  buyerSettled?: boolean;
  settlementAmount?: number;
  participantBalance?: number;
  participantId?: string;
  item?: string;
  quantity?: number;
  unitPrice?: number;
  priceIfConnected?: number;
  sentNicknames?: { nickname: string; sentAt?: string }[];
  [key: string]: any;
}

export default function BuyerInProgressDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [application, setApplication] = useState<ApplicationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejecting, setRejecting] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      setUser(currentUser);
    });

    if (!id) return;

    const docRef = doc(db, "applications", id);
    const unsubscribeSnapshot = onSnapshot(docRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...(docSnap.data() ?? {}) } as ApplicationData;
        setApplication(data);

        // 완료가 아니면 자동 정산
        if (data.status !== "완료") {
          await checkAndCompleteTransaction(id);
        }
      } else {
        setApplication(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [id, router]);

  const handleConfirm = async (nickname: string) => {
    if (!id) return;
    await confirmNickname(id, nickname);
    alert(`✅ 닉네임 ${nickname} 확인 처리 완료`);
    await checkAndCompleteTransaction(id);
  };

  const handleRejectClick = (nickname: string) => {
    setRejecting(nickname);
  };

  const handleRejectConfirm = async (
    nickname: string,
    reason: "접속한 계정" | "확인 불가"
  ) => {
    if (!id) return;
    await rejectNickname(id, nickname, reason);
    alert(`❌ 닉네임 ${nickname} '${reason}' 사유로 반려 처리 완료`);
    setRejecting(null);
    await checkAndCompleteTransaction(id);
  };

  const maskNickname = (nickname: string) =>
    nickname.includes("**") ? nickname : nickname.slice(0, 1) + "**";

  if (loading) return <p className="p-4">로딩 중...</p>;
  if (!application) return <p className="p-4">신청서를 찾을 수 없습니다.</p>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">🟢 진행중 거래 상세 (구매자)</h1>
      <p>항목: {application.item}</p>
      <p>상태: {application.status}</p>
      <p>수량: {application.quantity}</p>
      <p>개당 가격: {application.unitPrice?.toLocaleString()}원</p>
      {application.priceIfConnected && (
        <p>접속시 가격: {application.priceIfConnected.toLocaleString()}원</p>
      )}

      {/* 수신한 닉네임 확인 */}
      <div>
        <h2 className="font-semibold mt-4">📥 수신한 닉네임 확인</h2>
        {application.sentNicknames && application.sentNicknames.length > 0 ? (
          application.sentNicknames.map((n, idx) => (
            <div key={idx} className="border p-2 rounded my-1 space-y-2">
              <p>닉네임: {maskNickname(n.nickname)}</p>
              <p>전송 시각: {n.sentAt ? new Date(n.sentAt).toLocaleString() : "-"}</p>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleConfirm(n.nickname)}
                  className="flex-1 bg-green-500 text-white p-1 rounded"
                >
                  확인
                </button>
                {rejecting === n.nickname ? (
                  <div className="flex flex-col space-y-1 flex-1">
                    <button
                      onClick={() => handleRejectConfirm(n.nickname, "접속한 계정")}
                      className="bg-red-500 text-white p-1 rounded"
                    >
                      접속한 계정으로 반려
                    </button>
                    <button
                      onClick={() => handleRejectConfirm(n.nickname, "확인 불가")}
                      className="bg-red-400 text-white p-1 rounded"
                    >
                      확인 불가로 반려
                    </button>
                    <button
                      onClick={() => setRejecting(null)}
                      className="bg-gray-400 text-white p-1 rounded"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleRejectClick(n.nickname)}
                    className="flex-1 bg-red-500 text-white p-1 rounded"
                  >
                    반려
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <p>수신한 닉네임이 없습니다.</p>
        )}
      </div>

      {/* 완료 및 거절 표시 */}
      {application.status === "완료" && (
        <div className="bg-green-100 text-green-800 p-3 rounded text-center font-semibold">
          ✅ 거래 및 정산 완료: {application.settlementAmount?.toLocaleString()}원
        </div>
      )}
      {application.status === "거절됨" && (
        <div className="bg-red-100 text-red-800 p-3 rounded text-center font-semibold">
          ❌ 거래가 거절되었습니다. 고객센터에 문의해 주세요.
        </div>
      )}
    </div>
  );
}
