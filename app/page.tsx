'use client';

import { useRouter } from "next/navigation";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

export default function HomePage() {
  const router = useRouter();

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Firestore에서 역할 확인
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.role === "buyer") {
          router.push("/mypage/buyer");
        } else if (data.role === "seller") {
          router.push("/mypage/seller");
        } else {
          // 역할이 없으면 역할 선택 페이지로 이동
          router.push("/select-role");
        }
      } else {
        // 최초 로그인 시 Firestore에 정보 기록 후 역할 선택 페이지로 이동
        await setDoc(userRef, {
          email: user.email,
          createdAt: new Date(),
        });
        router.push("/select-role");
      }
    } catch (error) {
      console.error(error);
      alert("구글 로그인에 실패했습니다. 다시 시도해주세요.");
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
      {/* TocToc 로고 */}
      <h1
        className="text-4xl font-extrabold mb-8"
        style={{ color: "#25F4EE", fontFamily: "sans-serif" }}
      >
        TocToc
      </h1>

      {/* 구글 로그인 버튼 */}
      <button
        onClick={handleGoogleLogin}
        className="w-full max-w-xs bg-blue-500 hover:bg-blue-600 text-white rounded-full px-4 py-2 font-semibold"
      >
        구글로 로그인
      </button>

      {/* 하단 푸터 */}
      <footer className="absolute bottom-4 text-sm text-gray-600 text-center">
        <p>
          <a
            href="https://pf.kakao.com/_your_channel"
            target="_blank"
            className="text-blue-500 underline"
          >
            고객센터 문의
          </a>{" "}
          |{" "}
          <a href="/terms" className="underline">
            이용약관
          </a>{" "}
          |{" "}
          <a href="/privacy" className="underline">
            개인정보 처리방침
          </a>
        </p>
        <p className="mt-1">© 2025 TocToc</p>
      </footer>
    </div>
  );
}
