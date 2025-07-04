"use client";

import { useEffect, useState } from "react";
import {
  fetchAvailableApplications,
  participateInApplication,
  deleteApplication,
} from "@/lib/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function SellerDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      // ✅ 판매자 역할로 상대방(구매자) 신청서만 가져오기
      const fetchedApps = await fetchAvailableApplications(user.uid, "seller");
      const now = Date.now();
      const validApplications: any[] = [];

      for (const appData of fetchedApps) {
        const createdAt = appData.createdAt?.toDate().getTime() || 0;
        const elapsedSeconds = (now - createdAt) / 1000;

        if (elapsedSeconds > 600) {
          await deleteApplication(appData.id);
        } else {
          validApplications.push(appData);
        }
      }

      setApplications(validApplications);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">📜 판매자 거래목록</h1>
      <p className="text-sm text-gray-600">구매자가 작성한 신청서만 표시됩니다.</p>
      {message && <p className="text-red-500">{message}</p>}

      {applications.map((app) => (
        <div key={app.id} className="border p-2 rounded shadow">
          <p>항목: {app.item}</p>
          {app.item !== "물고기" && <p>상태: {app.status}</p>}
          <p>수량: {app.quantity}</p>
          <p>개당 금액(비밀가격): {app.price}원</p>
          {app.fishName && <p>물고기 이름: {app.fishName}</p>}
          <button
            onClick={async () => {
              if (!auth.currentUser) {
                setMessage("로그인이 필요합니다.");
                return;
              }
              await participateInApplication(app.id, auth.currentUser.uid);
              setMessage("✅ 거래 참여 완료");
            }}
            className="bg-blue-500 text-white px-2 py-1 rounded mt-2 w-full"
          >
            판매하기
          </button>
        </div>
      ))}
    </div>
  );
}
