"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { fetchInProgressApplications } from "@/lib/firestore";
import { auth } from "@/lib/firebase";

export default function BuyerInProgressPage() {
  const [applications, setApplications] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) return;
      const apps = await fetchInProgressApplications(user.uid, "buyer");
      setApplications(apps);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">🛒 구매자 진행중 거래</h1>
      {applications.length === 0 ? (
        <p>진행중인 거래가 없습니다.</p>
      ) : (
        applications.map((app) => (
          <div
            key={app.id}
            className="border p-2 rounded hover:bg-gray-100 cursor-pointer"
            onClick={() => router.push(`/inprogress/buyer/${app.id}`)}
          >
            <p>
              {app.item} {app.status} {app.quantity}개 개당 {app.unitPrice?.toLocaleString()}원
            </p>
          </div>
        ))
      )}
    </div>
  );
}
