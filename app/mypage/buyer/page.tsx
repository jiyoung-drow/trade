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
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { User, signOut } from "firebase/auth";
import { formatApplicationLine } from "@/lib/utils/formatApplicationLine";

export default function BuyerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [inProgressApplications, setInProgressApplications] = useState<any[]>([]);
  const [rejectedCharges, setRejectedCharges] = useState<any[]>([]);
  const [rejectedWithdraws, setRejectedWithdraws] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [adminAccount, setAdminAccount] = useState<string>("");

  const [isCharging, setIsCharging] = useState(false);
  const [chargeName, setChargeName] = useState("");
  const [chargeAmount, setChargeAmount] = useState<number | null>(null);

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) return;
      setUser(currentUser);

      const myQ = query(collection(db, "applications"), where("uid", "==", currentUser.uid));
      const unsubMy = onSnapshot(myQ, (snapshot) => {
        setMyApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      const inProgressQ = query(
        collection(db, "applications"),
        where("uid", "==", currentUser.uid),
        where("status", "==", "진행중")
      );
      const unsubProgress = onSnapshot(inProgressQ, (snapshot) => {
        setInProgressApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      const balanceRef = doc(db, "balances", currentUser.uid);
      const unsubBalance = onSnapshot(balanceRef, (docSnap) => {
        if (docSnap.exists()) {
          setBalance(docSnap.data().amount ?? 0);
        } else {
          setBalance(0);
        }
      });

      const rejectedChargesQ = query(
        collection(db, "chargeRequests"),
        where("uid", "==", currentUser.uid),
        where("status", "==", "거절됨"),
        where("checked", "==", false)
      );
      const unsubRejectedCharges = onSnapshot(rejectedChargesQ, (snapshot) => {
        setRejectedCharges(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      const rejectedWithdrawsQ = query(
        collection(db, "withdrawRequests"),
        where("uid", "==", currentUser.uid),
        where("status", "==", "거절됨"),
        where("checked", "==", false)
      );
      const unsubRejectedWithdraws = onSnapshot(rejectedWithdrawsQ, (snapshot) => {
        setRejectedWithdraws(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
      });

      const adminDoc = await getDoc(doc(db, "settings", "adminAccount"));
      if (adminDoc.exists()) {
        setAdminAccount(adminDoc.data().account ?? "");
      }

      setLoading(false);

      return () => {
        unsubMy();
        unsubProgress();
        unsubBalance();
        unsubRejectedCharges();
        unsubRejectedWithdraws();
      };
    });

    return () => unsubscribeAuth();
  }, []);

  // ✅ 거절된 충전 요청 확인
  const handleConfirmRejectedCharge = async (id: string) => {
    await updateDoc(doc(db, "chargeRequests", id), { checked: true });
    setRejectedCharges((prev) => prev.filter((c) => c.id !== id));
  };

  // ✅ 거절된 출금 요청 확인
  const handleConfirmRejectedWithdraw = async (id: string) => {
    await updateDoc(doc(db, "withdrawRequests", id), { checked: true });
    setRejectedWithdraws((prev) => prev.filter((w) => w.id !== id));
  };

  const handleDelete = async (id: string, status: string) => {
    if (status === "진행중" || status === "완료") {
      window.alert("진행중이거나 완료된 거래는 삭제할 수 없습니다.");
      return;
    }
    if (window.confirm("해당 신청서를 삭제하시겠습니까?")) {
      try {
        await deleteDoc(doc(db, "applications", id));
        window.alert("삭제 완료되었습니다.");
      } catch (error) {
        console.error(error);
        window.alert("삭제 중 오류가 발생했습니다.");
      }
    }
  };

  const handleLogout = async () => {
    if (!window.confirm("로그아웃하시겠습니까?")) return;
    try {
      await signOut(auth);
      window.alert("로그아웃되었습니다.");
      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert("로그아웃 중 오류가 발생했습니다.");
    }
  };

  const initiateChargeRequest = () => {
    const name = window.prompt("입금자명을 입력하세요:");
    if (!name) {
      window.alert("입금자명을 입력해주세요.");
      return;
    }
    const input = window.prompt("충전할 금액을 입력하세요:");
    if (!input) return;
    const amount = Number(input);
    if (isNaN(amount) || amount <= 0) {
      window.alert("유효한 금액을 입력해주세요.");
      return;
    }
    setChargeName(name);
    setChargeAmount(amount);
    setIsCharging(true);
  };

  const confirmChargeRequest = async () => {
    if (!user || !chargeName || !chargeAmount) return;
    try {
      await addDoc(collection(db, "chargeRequests"), {
        uid: user.uid,
        name: chargeName,
        amount: chargeAmount,
        createdAt: serverTimestamp(),
        status: "대기중",
        checked: false,
      });
      window.alert("충전 신청이 완료되었습니다. 입금 후 관리자 승인 시 반영됩니다.");
      setIsCharging(false);
      setChargeName("");
      setChargeAmount(null);
    } catch (error) {
      console.error(error);
      window.alert("충전 신청 중 오류가 발생했습니다.");
    }
  };

  const handleWithdrawRequest = async () => {
    const name = window.prompt("출금자 이름을 입력하세요:");
    if (!name) {
      window.alert("이름을 입력해주세요.");
      return;
    }
    const input = window.prompt("출금할 금액을 입력하세요:");
    if (!input) return;
    const amount = Number(input);
    if (isNaN(amount) || amount <= 0) {
      window.alert("유효한 금액을 입력해주세요.");
      return;
    }
    if (!user) return;
    try {
      await addDoc(collection(db, "withdrawRequests"), {
        uid: user.uid,
        name,
        amount,
        createdAt: serverTimestamp(),
        status: "대기중",
        checked: false,
      });
      window.alert("출금 신청이 완료되었습니다. 승인 후 반영됩니다.");
    } catch (error) {
      console.error(error);
      window.alert("출금 신청 중 오류가 발생했습니다.");
    }
  };

  if (loading) return <p className="p-4">로딩 중...</p>;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">🪐 구매자 마이페이지</h1>
      <div className="text-lg font-semibold">보유 금액: {balance.toLocaleString()}원</div>

      {isCharging ? (
        <div className="border rounded p-4 bg-gray-50 space-y-2">
          <p className="text-sm text-gray-700">
            💡 <b>{chargeAmount?.toLocaleString()}원</b> 입금 후 아래 버튼을 눌러주세요.
          </p>
          <p className="font-semibold">입금자명: {chargeName}</p>
          <p className="font-semibold">입금 계좌: {adminAccount || "관리자 계좌 미설정"}</p>
          <button
            onClick={confirmChargeRequest}
            className="w-full bg-green-600 text-white rounded p-2"
          >
            충전 신청 전송
          </button>
          <button
            onClick={() => setIsCharging(false)}
            className="w-full bg-gray-400 text-white rounded p-2"
          >
            취소
          </button>
        </div>
      ) : (
        <div className="flex space-x-2">
          <button
            onClick={initiateChargeRequest}
            className="flex-1 bg-green-600 text-white rounded p-2"
          >
            충전 신청
          </button>
          <button
            onClick={handleWithdrawRequest}
            className="flex-1 bg-blue-600 text-white rounded p-2"
          >
            출금 신청
          </button>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="w-full bg-gray-500 text-white rounded p-2"
      >
        로그아웃
      </button>

      {/* ✅ 거절된 충전 요청 */}
      <div>
        <h2 className="font-semibold mt-6">❌ 거절된 충전 요청</h2>
        {rejectedCharges.length === 0 ? (
          <p className="text-gray-600">거절된 충전 요청이 없습니다.</p>
        ) : (
          rejectedCharges.map((charge) => (
            <div key={charge.id} className="border rounded p-3 mb-2 bg-red-50 space-y-1">
              <p>💸 {charge.amount.toLocaleString()}원 충전 요청</p>
              <p className="text-sm text-red-700">거절 사유: {charge.reason || "사유 없음"}</p>
              <button
                onClick={() => handleConfirmRejectedCharge(charge.id)}
                className="text-xs bg-gray-600 text-white px-2 py-1 rounded"
              >
                확인
              </button>
            </div>
          ))
        )}
      </div>

      {/* ✅ 거절된 출금 요청 */}
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
                className="text-xs bg-gray-600 text-white px-2 py-1 rounded"
              >
                확인
              </button>
            </div>
          ))
        )}
      </div>

      {/* 내 신청서 */}
      <div>
        <h2 className="font-semibold mt-6">내 신청서</h2>
        {myApplications.length === 0 ? (
          <p className="text-gray-600">작성한 신청서가 없습니다.</p>
        ) : (
          myApplications.map((app) => (
            <div key={app.id} className="border rounded p-4 mb-2 space-y-1">
              <p>{formatApplicationLine(app)}</p>
              <p className="text-sm text-gray-600">상태: {app.status}</p>
              {app.status === "진행중" && (
                <p className="text-green-600 text-sm font-semibold">✅ 거래 진행 중</p>
              )}
              {app.status === "완료" && (
                <p className="text-blue-600 text-sm font-semibold">
                  ✅ 거래 완료 ({app.settlementAmount?.toLocaleString()}원)
                </p>
              )}
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

      {/* 진행중 거래 */}
      <div>
        <h2 className="font-semibold mt-6">진행중 거래 (판매자 참여)</h2>
        {inProgressApplications.length === 0 ? (
          <p className="text-gray-600">진행중인 거래가 없습니다.</p>
        ) : (
          inProgressApplications.map((app) => (
            <div key={app.id} className="border rounded p-4 mb-2 space-y-1">
              <p>{formatApplicationLine(app)}</p>
              <p className="text-green-600 text-sm font-semibold">✅ 거래 진행 중</p>
              <p className="text-sm text-gray-600">
                참여자 ID: {app.participantId || "없음"}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
