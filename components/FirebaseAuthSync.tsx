"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { signInWithCustomToken } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function FirebaseAuthSync() {
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.email) return;

    const run = async () => {
      const res = await fetch("/api/firebase-token");
      const { firebaseToken } = await res.json();
      if (firebaseToken) {
        await signInWithCustomToken(auth, firebaseToken);
        console.log("✅ Firebase 로그인됨");
      } else {
        console.warn("❌ 커스텀 토큰 없음");
      }
    };

    run();
  }, [session]);

  return null;
}
