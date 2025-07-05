"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { formatApplicationLine } from "@/lib/utils/formatApplicationLine";

export default function BuyerDashboard() {
  const [user, setUser] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [balance, setBalance] = useState<number>(0);
  const [message, setMessage] = useState<string>("");

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) return;
      setUser(currentUser);

      // 보유 금액
      const balanceDoc = await getDoc(doc(db, "balances", currentUser.uid));
      if (balanceDoc.exists()) {
        setBalance(balanceDoc.data().amount || 0);
      }

      // 판매자 신청서 가져오기
      const q = query(
        collection(db, "applications"),
        where("role", "==", "seller"),
        where("status", "in", ["미접", "접속"])
      );

      const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
        const fetched = snapshot.docs.map((doc) => {
          const data = doc.data();
          const basePrice = data.unitPrice || 0;
          let adjustedPrice = basePrice;
          let adjustedPriceIfConnected = data.priceIfConnected || 0;

          // ✅ 비밀 가산 가격 처리
          if (data.status === "미접") {
            adjustedPrice += 100;
          } else if (data.status === "접속") {
            adjustedPrice += 50;
          }

          // ✅ 접속시 가격도 비밀 가산 50원 추가
          if (data.priceIfConnected) {
            adjustedPriceIfConnected += 50;
          }

          return {
            id: doc.id,
            ...data,
            adjustedPrice,
            adjustedPriceIfConnected,
          };
        });
        setApplications(fetched);
      });
    });

    return () => unsubscribe();
  }, []);

  const handleParticipate = async (app: any) => {
    const priceToDeduct = app.adjustedPrice;

    if (balance < priceToDeduct) {
      setMessage(`⛔ 보유 금액이 부족합니다. (필요 금액: ${priceToDeduct.toLocaleString()}원)`);
      return;
    }

    if (!window.confirm(`${priceToDeduct.toLocaleString()}원으로 거래에 참여하시겠습니까?`)) {
      return;
    }

    try {
      await updateDoc(doc(db, "applications", app.id), {
        status: "진행중",
        participantId: user.uid,
        startedAt: new Date().toISOString(),
      });

      const newBalance = balance - priceToDeduct;
      await updateDoc(doc(db, "balances", user.uid), {
        amount: newBalance,
      });
      setBalance(newBalance);

      window.alert("✅ 거래에 참여하였습니다.");
    } catch (error) {
      console.error(error);
      setMessage("❌ 참여 처리 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-3">
      <h1 className="text-xl font-bold">📜 구매자 거래목록</h1>
      <div className="text-lg font-semibold">
        보유 금액: {balance.toLocaleString()}원
      </div>

      {message && <p className="text-red-500">{message}</p>}

      {applications.length === 0 && (
        <p className="text-gray-500">참여 가능한 신청서가 없습니다.</p>
      )}

      {applications.map((app) => (
        <div key={app.id} className="border rounded p-3 space-y-1">
          {/* ✅ 한 줄로 깔끔하게 표시 & 접속시 비밀 가격 가산 표시 */}
          <p className="text-base">
            {app.item} {app.status} {app.quantity}개 개당 {app.adjustedPrice.toLocaleString()}원
            {app.priceIfConnected && ` (접속시 ${app.adjustedPriceIfConnected.toLocaleString()}원)`}
          </p>
          <button
            onClick={() => handleParticipate(app)}
            className="w-full bg-green-500 text-white rounded p-2"
          >
            구매하기
          </button>
        </div>
      ))}
    </div>
  );
}
