'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../../../lib/firebase";
import { doc, setDoc } from "firebase/firestore";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleAdminSignup = async () => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        role: "admin",
      });
      alert("관리자 계정 생성 완료!");
    } catch (error) {
      alert("관리자 계정 생성 실패: " + error.message);
    }
  };

  const handleAdminLogin = async () => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
      router.push("/admin/dashboard"); // 관리자 페이지로 이동
    } catch (error) {
      alert("관리자 로그인 실패: " + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">관리자 전용 페이지</h1>
      <div className="w-full max-w-xs space-y-4">
        <input
          type="email"
          placeholder="관리자 이메일"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <input
          type="password"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full border rounded px-3 py-2"
          required
        />
        <button
          onClick={handleAdminLogin}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 font-semibold"
        >
          관리자 로그인
        </button>
        <button
          onClick={handleAdminSignup}
          className="w-full bg-gray-300 hover:bg-gray-400 text-gray-800 rounded-full px-4 py-2 font-semibold"
        >
          관리자 회원가입
        </button>
      </div>
    </div>
  );
}
