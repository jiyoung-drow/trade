"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ChargePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [senderName, setSenderName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCharge = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      alert("충전 금액을 정확히 입력해 주세요.");
      return;
    }

    if (!senderName.trim()) {
      alert("입금자명을 입력해 주세요.");
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
        type: "charge",
        amount: Number(amount),
        senderName: senderName.trim(),
        status: "pending",
        createdAt: serverTimestamp(),
      });

      alert("충전 요청이 완료되었습니다. 관리자의 승인 후 반영됩니다.");
      router.push("/mypage/buyer");
    } catch (error) {
      console.error("충전 요청 오류:", error);
      alert("충전 요청 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 font-sans">
      <h1 className="text-2xl font-bold text-center text-pink-500">
        보증금 충전
      </h1>

      <div className="space-y-2">
        <label className="block text-sm font-medium">입금자명</label>
        <input
          type="text"
          value={senderName}
          onChange={(e) => setSenderName(e.target.value)}
          placeholder="이름 입력"
          className="w-full border rounded p-2"
          disabled={loading}
        />

        <label className="block text-sm font-medium mt-4">충전 금액 (원)</label>
        <input
          type="text"
          value={amount}
          onChange={(e) => {
            const val = e.target.value;
            if (/^[0-9]*$/.test(val)) {
              setAmount(val);
            }
          }}
          placeholder="금액 입력"
          className="w-full border rounded p-2"
          disabled={loading}
          inputMode="numeric"
        />

        <button
          onClick={handleCharge}
          disabled={loading}
          className="w-full bg-red-400 hover:bg-red-500 text-white py-2 rounded font-semibold shadow transition disabled:opacity-50"
        >
          {loading ? "처리 중..." : "충전 요청"}
        </button>
      </div>

      <button
        onClick={() => router.push("/mypage/buyer")}
        className="w-full bg-gray-300 hover:bg-gray-400 text-sm py-2 rounded font-semibold mt-4 transition"
      >
        ⬅ 마이페이지로 돌아가기
      </button>
    </div>
  );
}
