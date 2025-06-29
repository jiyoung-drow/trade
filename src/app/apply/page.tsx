"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export default function ApplyPage() {
  const [nickname, setNickname] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [role, setRole] = useState("buyer");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname || !price || !quantity) {
      alert("모든 항목을 입력해주세요.");
      return;
    }

    try {
      await addDoc(collection(db, "applications"), {
        nickname,
        price: Number(price),
        quantity: Number(quantity),
        role,
        status: "미접",
        createdAt: serverTimestamp(),
      });
      alert("신청 완료!");
      router.push("/mypage");
    } catch (error) {
      console.error("Firestore 저장 오류:", error);
      alert("오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">거래 신청서 작성</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-xs">
        <input
          type="text"
          placeholder="닉네임"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="number"
          placeholder="가격"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="number"
          placeholder="수량"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="buyer">구매자</option>
          <option value="seller">판매자</option>
        </select>
        <button
          type="submit"
          className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
        >
          신청하기
        </button>
      </form>
    </div>
  );
}
