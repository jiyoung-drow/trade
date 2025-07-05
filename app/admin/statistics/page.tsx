// app/admin/statistics/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";

export default function AdminStatisticsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        onAuthStateChanged(auth, async (user) => {
          if (!user) {
            alert("로그인이 필요합니다.");
            router.push("/admin/login");
            return;
          }

          const userDoc = await getDoc(doc(db, "users", user.uid));
          const data = userDoc.data();
          if (!data || data.role !== "superadmin") {
            alert("접근 권한이 없습니다.");
            router.push("/admin/login");
            return;
          }

          // ✅ 통계 데이터 불러오기
          const statsSnap = await getDocs(collection(db, "statistics"));
          if (statsSnap.empty) {
            alert("통계 데이터가 존재하지 않습니다. 관리자에게 문의하세요.");
            setStats(null);
          } else {
            const dataArr = statsSnap.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setStats(dataArr);
          }

          setLoading(false);
        });
      } catch (error) {
        console.error("통계 불러오기 오류:", error);
        alert("통계 불러오는 중 오류가 발생했습니다.");
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) return <p className="p-4">통계 불러오는 중...</p>;

  return (
    <div className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">📊 통계 페이지</h1>

      {!stats ? (
        <p className="text-gray-600">표시할 통계 데이터가 없습니다.</p>
      ) : (
        stats.map((item: any) => (
          <div
            key={item.id}
            className="border rounded p-4 bg-gray-50 shadow-sm space-y-1"
          >
            <p className="font-semibold">🪐 {item.title || item.id}</p>
            <p>티켓 거래: {item.ticketCount ?? 0} 건</p>
            <p>꽃 거래: {item.flowerCount ?? 0} 건</p>
            <p>물고기 거래: {item.fishCount ?? 0} 건</p>
            <p>충전 승인: {item.chargeCount ?? 0} 건</p>
            <p>출금 승인: {item.withdrawCount ?? 0} 건</p>
            <p className="text-sm text-gray-500">
              마지막 업데이트: {item.updatedAt || "N/A"}
            </p>
          </div>
        ))
      )}
    </div>
  );
}
