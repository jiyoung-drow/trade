"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup } from "firebase/auth";
import { auth, db, googleProvider } from "@/lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { setAuthCookie } from "@/lib/setAuthCookie";

export default function AdminLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Firestore에 사용자 정보 없으면 생성
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        await setDoc(userRef, {
          email: user.email,
          role: "user", // 기본 user, 수동으로 관리자 권한 부여 필요
          createdAt: new Date().toISOString(),
        });
        alert("관리자 권한이 없는 계정입니다. 관리자에게 문의하세요.");
        return;
      }

      const data = userSnap.data();

      if (data?.role === "admin") {
        await setAuthCookie(user);
        router.push("/admin/requests");
      } else if (data?.role === "superadmin") {
        await setAuthCookie(user);
        router.push("/admin/super");
      } else {
        alert("관리자 권한이 없는 계정입니다. 관리자에게 문의하세요.");
      }
    } catch (error) {
      console.error(error);
      alert("로그인 실패: 계정 정보와 권한을 확인하세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center p-6 space-y-4">
      <button
        onClick={handleGoogleLogin}
        disabled={loading}
        className="w-full max-w-xs bg-blue-600 text-white p-3 rounded hover:bg-blue-700 disabled:bg-gray-400 text-lg font-semibold"
      >
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </div>
  );
}
