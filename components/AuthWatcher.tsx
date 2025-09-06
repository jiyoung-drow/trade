"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { signInWithCustomToken } from "firebase/auth";
import { db, auth } from "@/lib/firebase";
import type { Session } from "next-auth";

interface Props {
  session: Session | null;
}

export default function AuthWatcher({ session }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const syncAndCreateUser = async () => {
      const userId = session?.user?.id;
      const emailRaw = session?.user?.email;
      if (!userId || !emailRaw) return;

      const email = emailRaw.toLowerCase();
      const isAdmin = email === "shepollux@gmail.com";
      const userRef = doc(db, "users", userId);

      let firebaseUser = auth.currentUser;

      // ✅ Firebase 인증되지 않은 경우 커스텀 토큰으로 로그인 시도
      if (!firebaseUser) {
        try {
          const res = await fetch("/api/firebase-token");
          const data = await res.json();

          if (data?.firebaseToken) {
            const result = await signInWithCustomToken(auth, data.firebaseToken);
            console.log("✅ Firebase 로그인 완료:", result.user.uid);
            firebaseUser = result.user;
          } else {
            console.error("❌ Firebase 토큰 없음:", data);
            return;
          }
        } catch (e) {
          console.error("❌ Firebase 로그인 실패:", e);
          return;
        }
      } else {
        console.log("✅ 이미 Firebase에 로그인됨:", firebaseUser.uid);
      }

      // ✅ Firestore 사용자 문서 생성 또는 역할 확인
      try {
        const snap = await getDoc(userRef);

        if (!snap.exists()) {
          await setDoc(userRef, {
            uid: userId,
            email,
            role: null, // 기본 역할 없음
            balance: 0,
            createdAt: serverTimestamp(),
          });
          console.log("✅ 사용자 문서 생성됨 (role: null):", userId);
          router.replace("/role");
          return;
        }

        const data = snap.data();
        const role = data?.role;

        if (!role) {
          console.log("🟡 역할 없음 → /role 이동");
          router.replace("/role");
          return;
        }

        if (role === "admin" && !pathname.startsWith("/admin")) {
          console.log("🔁 관리자 자동 이동 → /admin");
          router.replace("/admin");
        }
      } catch (error) {
        console.error("❌ 사용자 문서 처리 실패:", error);
      }
    };

    if (session?.user?.id && session?.user?.email) {
      syncAndCreateUser();
    }
  }, [session, pathname, router]);

  return null;
}
