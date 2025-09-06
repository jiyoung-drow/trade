"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { onAuthStateChanged, signInWithCustomToken } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [roleChecked, setRoleChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // ✅ Firebase Auth 연동
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      unsub();
      if (!user) {
        try {
          const res = await fetch("/api/firebase-token");
          const data = await res.json();
          if (data?.firebaseToken) {
            await signInWithCustomToken(auth, data.firebaseToken);
            console.log("✅ Firebase 로그인 완료");
          }
        } catch (e) {
          console.error("❌ Firebase 인증 실패", e);
        }
      }
    });
  }, []);

  // ✅ 역할 확인 (FireStore)
  useEffect(() => {
    const checkRole = async () => {
      if (status !== "authenticated" || !session?.user?.id) return;

      try {
        const userRef = doc(db, "users", session.user.id);
        const snap = await getDoc(userRef);
        const role = snap.data()?.role;

        console.log("✅ Firestore에서 불러온 역할:", role);

        if (role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } catch (e) {
        console.error("❌ 역할 확인 실패", e);
        setIsAdmin(false);
      } finally {
        setRoleChecked(true);
      }
    };

    checkRole();
  }, [session, status]);

  // ✅ 관리자 아님: 리다이렉션 처리 (useEffect는 항상 무조건 실행)
  useEffect(() => {
    if (roleChecked && isAdmin === false) {
      console.warn("🚫 관리자 아님, 홈으로 이동");
      router.replace("/");
    }
  }, [roleChecked, isAdmin, router]);

  // ✅ 역할 확인 중 화면
  if (status === "loading" || !roleChecked) {
    return (
      <div className="p-10 text-center text-gray-500">역할 확인 중...</div>
    );
  }

  // ✅ 관리자 아님이면 null 반환 (렌더링 차단)
  if (isAdmin === false) return null;

  // ✅ 관리자일 경우만 children 출력
  return <>{children}</>;
}
