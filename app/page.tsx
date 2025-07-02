'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc } from "firebase/firestore";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Firestore에서 역할 확인 후 역할별 마이페이지로 이동
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role === "buyer") {
          router.push("/mypage/buyer");
        } else if (data.role === "seller") {
          router.push("/mypage/seller");
        } else {
          alert("역할 정보가 없습니다. 관리자에게 문의하세요.");
        }
      } else {
        alert("사용자 정보가 없습니다. 관리자에게 문의하세요.");
      }
    } catch (error) {
      alert("로그인 실패: 아이디와 비밀번호를 확인하세요.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      {/* TocToc 로고 */}
      <h1 className="text-4xl font-extrabold mb-8" style={{ color: "#25F4EE", fontFamily: "sans-serif" }}>
        TocToc
      </h1>

      {/* 로그인 폼 */}
      <form onSubmit={handleLogin} className="w-full max-w-xs space-y-4">
        <input
          type="text"
          placeholder="아이디(이메일)"
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
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 font-semibold"
        >
          로그인
        </button>
      </form>

      {/* 회원가입 버튼 */}
      <button
        onClick={() => router.push("/signup")}
        className="mt-4 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-full px-4 py-2 font-semibold"
      >
        회원가입
      </button>

      {/* 하단 푸터 */}
      <footer className="absolute bottom-4 text-sm text-gray-600 text-center">
        <p>
          <a href="https://pf.kakao.com/_your_channel" target="_blank" className="text-blue-500 underline">고객센터 문의</a> |{" "}
          <a href="/terms" className="underline">이용약관</a> |{" "}
          <a href="/privacy" className="underline">개인정보 처리방침</a>
        </p>
        <p className="mt-1">© 2025 TocToc</p>
      </footer>
    </div>
  );
}
