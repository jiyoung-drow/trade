"use client";

import { useEffect, useState } from "react";
import { fetchAvailableApplications, participateInApplication, deleteApplication } from "@/lib/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

export default function BuyerDashboard() {
  const [applications, setApplications] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      const mySnap = await fetchAvailableApplications(user.uid, "buyer");
      const now = Date.now();
      const validApplications: any[] = [];

      for (const docSnap of mySnap.docs) {
        const data = docSnap.data() as { createdAt?: any; [key: string]: any }; // ✅ createdAt 타입 인식
        const appData = { id: docSnap.id, ...data };

        const createdAt = appData.createdAt?.toDate().getTime() || 0;
        const elapsedSeconds = (now - createdAt) / 1000;

        if (elapsedSeconds > 600) {
          // 10분 경과한 신청서 자동 삭제
          await deleteApplication(docSnap.id);
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
      <h1 className="text-xl font-bold mb-2">📜 구매자 거래목록</h1>
      <p className="text-sm text-gray-600">구매자가 작성한 신청서는 목록 맨 위에 고정되며 10분 후 자동 삭제됩니다.</p>
      {message && <p className="text-red-500">{message}</p>}

      {applications.map((app) => (
        <div key={app.id} className="border p-2 rounded shadow">
          <p>항목: {app.item}</p>
          {app.item !== "물고기" && <p>상태: {app.status}</p>}
          <p>수량: {app.quantity}</p>
          <p>개당 금액: {app.price}원</p>
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
            className="bg-green-500 text-white px-2 py-1 rounded mt-2 w-full"
          >
            구매하기
          </button>
        </div>
      ))}
    </div>
  );
}
