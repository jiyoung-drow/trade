"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function RoleSelectionPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // 이미 role 있는 경우 자동 리디렉션
  useEffect(() => {
    const checkRole = async () => {
      if (status === "loading") return;
      if (!session?.user?.id) {
        router.replace("/");
        return;
      }

      const userRef = doc(db, "users", session.user.id);
      const snap = await getDoc(userRef);
      const role = snap.data()?.role;

      if (role === "admin") router.replace("/admin");
      else if (role === "buyer") router.replace("/mypage/buyer");
      else if (role === "seller") router.replace("/mypage/seller");
    };

    checkRole();
  }, [session, status]);

  // 역할 선택 함수 (공통)
  const handleSelectRole = async (role: "buyer" | "seller") => {
    if (!session?.user?.id) return;

    const userRef = doc(db, "users", session.user.id);
    await updateDoc(userRef, { role });

    if (role === "buyer") router.replace("/mypage/buyer");
    else if (role === "seller") router.replace("/mypage/seller");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen font-sans space-y-6">
      <h1 className="text-2xl font-bold text-pink-500">역할 선택</h1>
      <p className="text-sm text-red-500">
        ⚠️ 주의: 선택한 역할은 이후 변경이 불가합니다.
      </p>
      <div className="flex space-x-4">
        <button
          className="bg-green-500 text-white px-4 py-2 rounded"
          onClick={() => handleSelectRole("buyer")}
        >
          구매자로 시작하기
        </button>
        <button
          className="bg-blue-500 text-white px-4 py-2 rounded"
          onClick={() => handleSelectRole("seller")}
        >
          판매자로 시작하기
        </button>
      </div>
    </div>
  );
}
