"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  getDoc,
  doc,
  Timestamp,
  query,
  orderBy,
} from "firebase/firestore";

interface User {
  balance: number;
}

export default function Mypage() {
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<number | "">("");
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [account, setAccount] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [notifications, setNotifications] = useState<any[]>([]);

  const userId = "USER_ID_SAMPLE"; // 실제 로그인 연동 시 교체

  useEffect(() => {
    const userRef = doc(db, "users", userId);
    const unsub = onSnapshot(userRef, (snapshot) => {
      if (snapshot.exists()) {
        const userData = snapshot.data() as User;
        setBalance(userData.balance);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, "notifications", userId, "items"),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setNotifications(data);
    });
    return () => unsub();
  }, []);

  const handleCharge = async () => {
    if (!amount || amount <= 0) {
      alert("충전 금액을 입력해주세요.");
      return;
    }
    await addDoc(collection(db, "chargeRequests"), {
      userId,
      amount,
      status: "pending",
      requestedAt: Timestamp.now(),
    });
    alert("충전 신청 완료. 관리자 승인 후 반영됩니다.");
    setAmount("");
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || withdrawAmount <= 0 || !account || !name) {
      alert("출금 금액, 계좌, 이름을 입력해주세요.");
      return;
    }
    await addDoc(collection(db, "withdrawRequests"), {
      userId,
      amount: withdrawAmount,
      account,
      name,
      status: "pending",
      requestedAt: Timestamp.now(),
    });
    alert("출금 신청 완료. 관리자 승인 후 반영됩니다.");
    setWithdrawAmount("");
    setAccount("");
    setName("");
  };

  return (
    <main className="p-4 space-y-4 max-w-md mx-auto">
      <h1 className="text-lg font-bold">🧾 마이페이지</h1>
      <p>💰 현재 보유 금액: {balance} 원</p>

      {notifications.length > 0 && (
        <div className="bg-yellow-100 border border-yellow-300 p-3 rounded">
          <h2 className="font-semibold mb-2">📢 최근 알림</h2>
          {notifications.slice(0, 5).map((n) => (
            <div key={n.id} className="text-sm border-b py-1">
              {n.message}
            </div>
          ))}
        </div>
      )}

      <div className="border p-4 rounded space-y-3">
        <h2 className="font-semibold">💸 충전 신청</h2>
        <input
          type="number"
          value={amount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") {
              setAmount("");
              return;
            }
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
              setAmount(parsed);
            }
          }}
          placeholder="충전 금액"
          className="border p-2 rounded w-full"
        />
        <button
          onClick={handleCharge}
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
        >
          충전 신청
        </button>
      </div>

      <div className="border p-4 rounded space-y-3">
        <h2 className="font-semibold">🏦 출금 신청</h2>
        <input
          type="number"
          value={withdrawAmount}
          onChange={(e) => {
            const value = e.target.value;
            if (value === "") {
              setWithdrawAmount("");
              return;
            }
            const parsed = parseInt(value, 10);
            if (!isNaN(parsed)) {
              setWithdrawAmount(parsed);
            }
          }}
          placeholder="출금 금액"
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="계좌번호"
          className="border p-2 rounded w-full"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="이름"
          className="border p-2 rounded w-full"
        />
        <button
          onClick={handleWithdraw}
          className="bg-green-600 text-white px-4 py-2 rounded w-full"
        >
          출금 신청
        </button>
      </div>
    </main>
  );
}
