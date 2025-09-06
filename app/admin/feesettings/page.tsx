"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
} from "firebase/firestore";
import TabBar from "@/components/TabBar";

export default function FeeSettingsPage() {
  const [fees, setFees] = useState({
    "미접": 100,
    "접속": 50,
    "UR": 1000,
    "SSR": 500,
    "SR": 100,
    "저금통": 50,
    "낚시도움": 50, // 낚시도움 항목 추가
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFees = async () => {
      const ref = doc(db, "admin_settings", "fee_settings");
      const snap = await getDoc(ref);
      if (snap.exists()) {
        setFees((prev) => ({
          ...prev,
          ...snap.data(),
        }));
      }
      setLoading(false);
    };
    fetchFees();
  }, []);

  const handleChange = (key: string, value: string) => {
    const num = parseInt(value);
    if (!isNaN(num)) {
      setFees((prev) => ({
        ...prev,
        [key]: num,
      }));
    }
  };

  const saveFees = async () => {
    try {
      const ref = doc(db, "admin_settings", "fee_settings");
      await setDoc(ref, fees);
      alert("수수료 설정이 저장되었습니다.");
    } catch (err) {
      console.error("❌ 저장 실패:", err);
      alert("저장 중 오류가 발생했습니다.");
    }
  };

  if (loading) {
    return (
      <main className="max-w-md mx-auto p-4">
        <TabBar />
        <p className="text-center text-gray-400">로딩 중...</p>
      </main>
    );
  }

  return (
    <main className="max-w-md mx-auto p-4">
      <TabBar />
      <h1 className="text-lg font-bold mb-4 text-center">💰 수수료 설정</h1>
      <div className="space-y-4">
        {Object.entries(fees).map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <label className="w-32 text-sm font-semibold">{key}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => handleChange(key, e.target.value)}
              className="flex-1 border p-2 rounded text-sm"
            />
            <span className="text-sm">원</span>
          </div>
        ))}
      </div>
      <div className="text-center mt-6">
        <button
          onClick={saveFees}
          className="bg-blue-600 text-white px-6 py-2 rounded"
        >
          저장
        </button>
      </div>
    </main>
  );
}