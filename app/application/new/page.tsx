'use client';

import { useState } from "react";
import { auth } from "@/lib/firebase";
import { createApplication } from "@/lib/firestore";
import { useRouter } from "next/navigation";

export default function ApplicationNewPage() {
  const [item, setItem] = useState("");
  const [fishName, setFishName] = useState("");
  const [connectedPrice, setConnectedPrice] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const handleSubmit = async () => {
    if (!item) {
      setMessage("항목을 입력하세요.");
      return;
    }
    if (item === "물고기" && !fishName) {
      setMessage("물고기 종류를 입력하세요.");
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      setMessage("로그인이 필요합니다.");
      return;
    }

    try {
      await createApplication({
        item,
        fishName,
        connectedPrice,
        userId: user.uid,
        createdAt: new Date(),
        status: "미접",
      });
      setMessage("✅ 신청서가 등록되었습니다.");
      router.push("/dashboard/buyer");
    } catch (error) {
      console.error(error);
      setMessage("신청서 등록 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold">신청서 작성</h1>
      <input
        placeholder="항목 (예: 물고기)"
        value={item}
        onChange={(e) => setItem(e.target.value)}
        className="border p-2 rounded w-full"
      />
      {item === "물고기" && (
        <input
          placeholder="물고기 종류"
          value={fishName}
          onChange={(e) => setFishName(e.target.value)}
          className="border p-2 rounded w-full"
        />
      )}
      <input
        placeholder="금액"
        value={connectedPrice}
        onChange={(e) => setConnectedPrice(e.target.value)}
        className="border p-2 rounded w-full"
      />
      <button
        onClick={handleSubmit}
        className="bg-blue-500 text-white px-4 py-2 rounded w-full"
      >
        신청서 등록
      </button>
      {message && <p>{message}</p>}
    </div>
  );
}
