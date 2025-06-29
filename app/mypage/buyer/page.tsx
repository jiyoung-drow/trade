"use client";

import { useEffect, useState } from "react";
import { fetchUserApplications, participateInApplication } from "../../../src/lib/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";

const auth = getAuth();

export default function BuyerMypage() {
  const [apps, setApps] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    onAuthStateChanged(auth, async (user) => {
      if (user) {
        const res = await fetchUserApplications(user.uid, "buyer");
        setApps(res);
      } else {
        setMessage("로그인이 필요합니다.");
      }
    });
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">거래 신청서 목록</h1>
      {message && <p>{message}</p>}
      {apps.map((app) => (
        <div key={app.id} className="border p-2 rounded">
          <p>상태: {app.status}</p>
          <p>수량: {app.quantity}</p>
          <p>가격: {app.price}원</p>
          <button
            onClick={async () => {
              if (!auth.currentUser) {
                setMessage("로그인이 필요합니다.");
                return;
              }
              await participateInApplication(app.id, auth.currentUser.uid);
              setMessage("✅ 거래 참여 완료");
            }}
            className="bg-green-500 text-white px-2 py-1 rounded mt-2"
          >
            참여하기
          </button>
        </div>
      ))}
    </div>
  );
}
