"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  getDoc,
  doc,
} from "firebase/firestore";

export default function WithdrawPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [amount, setAmount] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // ✅ 사용자 보증금 가져오기
  useEffect(() => {
    const fetchBalance = async () => {
      if (!session?.user?.id) return;
      const userRef = doc(db, "users", session.user.id);
      const snap = await getDoc(userRef);
      const data = snap.data();
      if (data?.balance) {
        setBalance(data.balance);
      }
    };
    fetchBalance();
  }, [session]);

  const handleWithdraw = async () => {
    const numAmount = Number(amount);

    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      alert("출금 금액을 정확히 입력해 주세요.");
      return;
    }

    if (numAmount > balance) {
      alert("❌ 출금 금액이 보유 보증금을 초과합니다.");
      return;
    }

    if (!accountHolder.trim() || !bankName.trim() || !accountNumber.trim()) {
      alert("예금자명, 은행명, 계좌번호를 모두 입력해 주세요.");
      return;
    }

    if (!session?.user?.id || !session.user.email) {
      alert("로그인이 필요합니다.");
      return;
    }

    try {
      setLoading(true);

      await addDoc(collection(db, "transactions"), {
        uid: session.user.id,
        email: session.user.email,
        type: "withdraw",
        amount: numAmount,
        accountHolder: accountHolder.trim(),
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert("출금 요청이 완료되었습니다.\n관리자의 승인 후 처리됩니다.");
      router.push("/mypage");
    } catch (error) {
      console.error("출금 요청 오류:", error);
      alert("출금 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 font-sans">
      <h1 className="text-2xl font-bold text-center text-pink-500">
        보증금 출금
      </h1>

      <p className="text-center text-sm text-gray-600">
        현재 보유 보증금:{" "}
        <span className="text-blue-600 font-semibold">
          {balance.toLocaleString()}원
        </span>
      </p>

      <div className="space-y-3">
        <label className="block text-sm font-medium">예금자명</label>
        <input
          type="text"
          value={accountHolder}
          onChange={(e) => setAccountHolder(e.target.value)}
          placeholder="예: 홍길동"
          className="w-full border rounded p-2"
          disabled={loading}
        />

        <label className="block text-sm font-medium">은행명</label>
        <input
          type="text"
          value={bankName}
          onChange={(e) => setBankName(e.target.value)}
          placeholder="예: 카카오뱅크"
          className="w-full border rounded p-2"
          disabled={loading}
        />

        <label className="block text-sm font-medium">계좌번호</label>
        <input
          type="text"
          value={accountNumber}
          onChange={(e) => setAccountNumber(e.target.value)}
          placeholder="예: 3333-12-3456789"
          className="w-full border rounded p-2"
          disabled={loading}
        />

        <label className="block text-sm font-medium">출금 금액 (원)</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="출금할 금액 입력"
          className="w-full border rounded p-2"
          disabled={loading}
        />

        <button
          onClick={handleWithdraw}
          disabled={loading}
          className="w-full bg-yellow-400 hover:bg-yellow-500 text-white py-2 rounded font-semibold shadow transition disabled:opacity-50"
        >
          {loading ? "처리 중..." : "출금 요청"}
        </button>
      </div>

      <button
        onClick={() => router.push("/mypage")}
        className="w-full bg-gray-300 hover:bg-gray-400 text-sm py-2 rounded font-semibold mt-4 transition"
      >
        ⬅ 마이페이지로 돌아가기
      </button>
    </div>
  );
}
