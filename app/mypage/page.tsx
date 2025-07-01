'use client';

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";

export default function RedirectPage() {
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role === "buyer") {
            router.push("/mypage/buyer");
          } else if (data.role === "seller") {
            router.push("/mypage/seller");
          } else {
            alert("역할 정보가 잘못되었습니다.");
          }
        } else {
          alert("유저 정보가 없습니다.");
        }
      } else {
        router.push("/login");
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <div className="flex justify-center items-center min-h-screen">
      <p>로그인 확인 중...</p>
    </div>
  );
}
