"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useSession } from "next-auth/react";

export default function TabBar() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [role, setRole] = useState<"loading" | "buyer" | "seller" | null>("loading");

  useEffect(() => {
    const fetchUserRole = async () => {
      if (!session?.user?.id) {
        setRole(null);
        return;
      }

      try {
        const docRef = doc(db, "users", session.user.id);
        const snap = await getDoc(docRef);

        if (snap.exists()) {
          const data = snap.data();
          const userRole = data?.role;
          if (userRole === "buyer" || userRole === "seller") {
            setRole(userRole);
          } else {
            setRole(null);
          }
        } else {
          setRole(null);
        }
      } catch (error) {
        console.error("❌ 역할 불러오기 실패:", error);
        setRole(null);
      }
    };

    if (status === "authenticated") {
      fetchUserRole();
    }
  }, [session?.user?.id, status]);

  if (
    pathname === "/" ||
    pathname.startsWith("/admin") ||
    pathname === "/role"
  ) {
    return null;
  }

  if (role === "loading" || !role) return null;

  const tradePath = `/trade/${role}`; // ✅ /trade/seller or /trade/buyer
  const myPagePath = `/mypage/${role}`; // ✅ /mypage/seller or /mypage/buyer

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t flex justify-around py-2 shadow md:max-w-md md:mx-auto z-50">
      <Link href={tradePath} className="flex flex-col items-center text-xs">
        <span
          className={`text-lg ${
            pathname.startsWith("/trade") && !pathname.startsWith("/trade/fish")
              ? "text-blue-500"
              : "text-gray-500"
          }`}
        >
          💱
        </span>
        <span
          className={`${
            pathname.startsWith("/trade") && !pathname.startsWith("/trade/fish")
              ? "text-blue-500 font-semibold"
              : "text-gray-500"
          }`}
        >
          거래
        </span>
      </Link>

      {/* New Fish Trade Link */}
      <Link href="/trade/fish" className="flex flex-col items-center text-xs">
        <span
          className={`text-lg ${
            pathname.startsWith("/trade/fish") ? "text-blue-500" : "text-gray-500"
          }`}
        >
          🎣
        </span>
        <span
          className={`${
            pathname.startsWith("/trade/fish")
              ? "text-blue-500 font-semibold"
              : "text-gray-500"
          }`}
        >
          물고기 거래
        </span>
      </Link>

      <Link
        href="/application/new"
        className="flex flex-col items-center text-xs"
      >
        <span
          className={`text-lg ${
            pathname === "/application/new" ? "text-blue-500" : "text-gray-500"
          }`}
        >
          📝
        </span>
        <span
          className={`${
            pathname === "/application/new"
              ? "text-blue-500 font-semibold"
              : "text-gray-500"
          }`}
        >
          신청서 작성
        </span>
      </Link>

      <Link
        href="/application/mine"
        className="flex flex-col items-center text-xs"
      >
        <span
          className={`text-lg ${
            pathname === "/application/mine" ? "text-blue-500" : "text-gray-500"
          }`}
        >
          📋
        </span>
        <span
          className={`${
            pathname === "/application/mine"
              ? "text-blue-500 font-semibold"
              : "text-gray-500"
          }`}
        >
          내 신청서
        </span>
      </Link>

      <Link href={myPagePath} className="flex flex-col items-center text-xs">
        <span
          className={`text-lg ${
            pathname.startsWith("/mypage") ? "text-blue-500" : "text-gray-500"
          }`}
        >
          👤
        </span>
        <span
          className={`${
            pathname.startsWith("/mypage")
              ? "text-blue-500 font-semibold"
              : "text-gray-500"
          }`}
        >
          마이페이지
        </span>
      </Link>
    </div>
  );
}