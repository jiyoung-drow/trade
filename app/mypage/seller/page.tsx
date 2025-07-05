"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { User, signOut } from "firebase/auth";
import { formatApplicationLine } from "@/lib/utils/formatApplicationLine";

export default function SellerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [participatedApplications, setParticipatedApplications] = useState<any[]>([]);
  const [rejectedWithdraws, setRejectedWithdraws] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) return;
      setUser(currentUser);

      // 내가 작성한 신청서 구독
      const myQ = query(collection(db, "applications"), where("uid", "==", currentUser.uid));
      const unsubMy = onSnapshot(myQ, (snapshot) => {
        setMyApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      // 내가 참여한 진행중 거래 구독
      const participatedQ = query(
        collection(db, "applications"),
        where("participantId", "==", currentUser.uid),
        where("status", "==", "진행중")
      );
      const unsubParticipated = onSnapshot(participatedQ, (snapshot) => {
        setParticipatedApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      // 보유 금액 구독
      const balanceRef = doc(db, "balances", currentUser.uid);
      const unsubBalance = onSnapshot(balanceRef, (docSnap) => {
        if (docSnap.exists()) {
          setBalance(docSnap.data().amount ?? 0);
        } else {
          setBalance(0);
        }
      });

      // 거절된 출금 요청 구독
      const rejectedWithdrawsQ = query(
        collection(db, "withdrawRequests"),
        where("uid", "==", currentUser.uid),
        where("status", "==", "거절됨")
      );
      const unsubRejectedWithdraws = onSnapshot(rejectedWithdrawsQ, (snapshot) => {
        setRejectedWithdraws(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      setLoading(false);

      return () => {
        unsubMy();
        unsubParticipated();
        unsubBalance();
        unsubRejectedWithdraws();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  const handleDelete = async (id: string, status: string) => {
    if (status === "진행중" || status === "완료") {
      alert("진행중이거나 완료된 거래는 삭제할 수 없습니다.");
      return;
    }

    if (confirm("해당 신청서를 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "applications", id));
      alert("삭제 완료되었습니다.");
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    alert("로그아웃되었습니다.");
    window.location.href = "/";
  };

  const handleWithdrawRequest = async () => {
    const name = prompt("출금자 이름을 입력하세요:");
    if (!name) return alert("이름을 입력해주세요.");

    const amount = Number(prompt("출금할 금액을 입력하세요:"));
    if (!amount || amount <= 0) return alert("유효한 금액을 입력해주세요.");
    if (!user) return;

    await addDoc(collection(db, "withdrawRequests"), {
      uid: user.uid,
      name,
      amount,
      createdAt: serverTimestamp(),
      status: "대기중",
    });

    alert("출금 신청이 완료되었습니다. 관리자가 승인 시 반영됩니다.");
  };

  const handleConfirmRejectedWithdraw = async (id: string) => {
    if (!confirm("이 거절된 요청을 목록에서 제거하시겠습니까?")) return;
    await deleteDoc(doc(db, "withdrawRequests", id));
    alert("해당 거절된 요청이 제거되었습니다.");
  };

  if (loading) return <p className="p-4">로딩 중...</p>;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">🛒 판매자 마이페이지</h1>
      <div className="text-lg font-semibold">보유 금액: {balance.toLocaleString()}원</div>

      <button
        onClick={handleWithdrawRequest}
        className="w-full bg-blue-600 text-white rounded p-2"
      >
        출금 신청
      </button>

      <button
        onClick={handleLogout}
        className="w-full bg-gray-500 text-white rounded p-2"
      >
        로그아웃
      </button>

      {/* 거절된 출금 요청 */}
      <div>
        <h2 className="font-semibold mt-6">❌ 거절된 출금 요청</h2>
        {rejectedWithdraws.length === 0 ? (
          <p className="text-gray-600">거절된 출금 요청이 없습니다.</p>
        ) : (
          rejectedWithdraws.map((withdraw) => (
            <div key={withdraw.id} className="border rounded p-3 mb-2 bg-red-50 space-y-1">
              <p>💸 {withdraw.amount.toLocaleString()}원 출금 요청</p>
              <p className="text-sm text-red-700">거절 사유: {withdraw.reason || "사유 없음"}</p>
              <button
                onClick={() => handleConfirmRejectedWithdraw(withdraw.id)}
                className="w-full bg-green-600 text-white rounded p-1"
              >
                확인 (목록에서 제거)
              </button>
            </div>
          ))
        )}
      </div>

      {/* 내가 작성한 신청서 */}
      <div>
        <h2 className="font-semibold mt-6">내 신청서</h2>
        {myApplications.length === 0 ? (
          <p className="text-gray-600">작성한 신청서가 없습니다.</p>
        ) : (
          myApplications.map((app) => (
            <div key={app.id} className="border rounded p-4 mb-2 space-y-1">
              <p>{formatApplicationLine(app)}</p>
              <button
                onClick={() => handleDelete(app.id, app.status)}
                className="bg-red-500 text-white rounded p-1 mt-2 w-full"
              >
                삭제
              </button>
            </div>
          ))
        )}
      </div>

      {/* 내가 참여한 진행중 거래 */}
      <div>
        <h2 className="font-semibold mt-6">진행중 거래 (참여한 거래)</h2>
        {participatedApplications.length === 0 ? (
          <p className="text-gray-600">참여한 진행중 거래가 없습니다.</p>
        ) : (
          participatedApplications.map((app) => (
            <div key={app.id} className="border rounded p-4 mb-2">
              <p>{formatApplicationLine(app)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
