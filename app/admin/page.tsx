"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { auth } from "@/lib/firebase";
import { signOut as firebaseSignOut } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function AdminDashboardPage() {
  const router = useRouter();
  const [supportLink, setSupportLink] = useState("");
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState("");

  const handleLogout = async () => {
    await firebaseSignOut(auth); // Firebase 로그아웃
    await signOut(); // NextAuth 로그아웃
  };

  const fetchSupportLink = async () => {
    try {
      const docRef = doc(db, "config", "support");
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setSupportLink(snap.data().link || "");
      }
    } catch (err) {
      console.error("❌ 고객센터 링크 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLink = async () => {
    try {
      const docRef = doc(db, "config", "support");
      await setDoc(docRef, { link: supportLink }, { merge: true });
      setStatusMsg("✅ 저장되었습니다.");
      setTimeout(() => setStatusMsg(""), 2000);
    } catch (err) {
      console.error("❌ 저장 실패:", err);
      setStatusMsg("❌ 저장 실패");
    }
  };

  useEffect(() => {
    fetchSupportLink();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 font-sans">
      <h1 className="text-2xl font-bold text-center text-pink-500">
        관리자 대시보드
      </h1>

      {/* 🔹 충전/출금 관리 */}
      <button
        onClick={() => router.push("/admin/charge")}
        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-semibold shadow"
      >
        💳 충전 요청 관리
      </button>

      <button
        onClick={() => router.push("/admin/withdraws")}
        className="w-full bg-green-500 hover:bg-green-600 text-white py-2 rounded font-semibold shadow"
      >
        💸 출금 요청 관리
      </button>

      {/* 🔹 기타 관리 기능 */}
      <button
        onClick={() => router.push("/admin/users")}
        className="w-full bg-purple-500 hover:bg-purple-600 text-white py-2 rounded font-semibold shadow"
      >
        회원 목록 보기
      </button>

      <button
        onClick={() => router.push("/admin/applications")}
        className="w-full bg-yellow-500 hover:bg-yellow-600 text-white py-2 rounded font-semibold shadow"
      >
        전체 신청서 목록
      </button>

      <button
        onClick={() => router.push("/admin/transactions")}
        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white py-2 rounded font-semibold shadow"
      >
        거래 기록 관리
      </button>

      {/* 🔹 승인 불가 닉네임 관리 */}
      <button
        onClick={() => router.push("/admin/needsadmin")}
        className="w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded font-semibold shadow"
      >
        🔴 승인 불가 신청서 관리
      </button>

      {/* 🔹 자동 입금 내역 */}
      <button
        onClick={() => router.push("/admin/autodeposits")}
        className="w-full bg-teal-500 hover:bg-teal-600 text-white py-2 rounded font-semibold shadow"
      >
        자동 입금 내역 보기
      </button>

      {/* ✅ 수수료 설정 */}
      <button
        onClick={() => router.push("/admin/feesettings")}
        className="w-full bg-pink-500 hover:bg-pink-600 text-white py-2 rounded font-semibold shadow"
      >
        🧾 수수료 설정
      </button>

      {/* 🔹 고객센터 링크 설정 */}
      <div className="mt-6 border p-4 rounded bg-gray-50 space-y-2">
        <h2 className="font-semibold text-gray-800">🛠 고객센터 링크 설정</h2>
        <input
          type="text"
          className="w-full border px-2 py-1 rounded"
          placeholder="https://example.com/support"
          value={supportLink}
          onChange={(e) => setSupportLink(e.target.value)}
          disabled={loading}
        />
        <button
          onClick={handleSaveLink}
          className="bg-blue-600 text-white px-4 py-1 rounded text-sm"
          disabled={loading || !supportLink}
        >
          저장
        </button>
        {statusMsg && <p className="text-sm text-gray-600">{statusMsg}</p>}
      </div>

      {/* 🔹 로그아웃 */}
      <button
        onClick={handleLogout}
        className="w-full bg-gray-400 hover:bg-gray-500 text-white py-2 rounded font-semibold shadow mt-8"
      >
        로그아웃
      </button>
    </div>
  );
}