"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { ReactNode, useEffect } from "react";
import AuthWatcher from "@/components/AuthWatcher";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <SessionWatcher />
      {children}
    </SessionProvider>
  );
}

function SessionWatcher() {
  const { data: session, status } = useSession();
  const isAuthenticated = !!session?.user?.id;

  useEffect(() => {
    const loginToFirebase = async () => {
      if (!isAuthenticated) {
        console.warn("❌ 세션 없음 → Firebase 로그인 스킵");
        return;
      }

      // 이미 Firebase에 로그인된 경우 중복 로그인 방지
      if (auth.currentUser) {
        console.log("✅ Firebase 이미 로그인됨:", auth.currentUser.uid);
        return;
      }

      try {
        const res = await fetch("/api/firebase-token");
        const { firebaseToken } = await res.json();

        if (!firebaseToken) {
          console.error("❌ 커스텀 토큰 없음:", res);
          return;
        }

        const result = await signInWithCustomToken(auth, firebaseToken);
        console.log("✅ Firebase 로그인 성공:", result.user.uid);
      } catch (err) {
        console.error("❌ Firebase 로그인 실패:", err);
      }
    };

    loginToFirebase();

    // 디버깅: window.auth에서 Firebase 상태 확인 가능
    if (typeof window !== "undefined") {
      (window as any).auth = auth;
    }
  }, [isAuthenticated]);

  // 세션 로딩 중엔 아무것도 렌더링하지 않음
  if (status === "loading") return null;

  // 세션이 있을 때만 AuthWatcher 렌더링
  return isAuthenticated ? <AuthWatcher session={session} /> : null;
}
