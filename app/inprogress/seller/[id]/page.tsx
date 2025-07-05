"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
} from "firebase/firestore";
import Link from "next/link";

export default function SellerInProgressPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ 유저 인증
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (!currentUser) {
        router.push("/");
        return;
      }
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, [router]);

  // ✅ 판매자가 작성하여 구매자가 참여한 거래 + 판매자가 참여한 거래 모두 표시
  useEffect(() => {
    if (!user) return;

    const sellerWrittenQuery = query(
      collection(db, "applications"),
      where("uid", "==", user.uid),
      where("status", "==", "진행중")
    );

    const sellerParticipatedQuery = query(
      collection(db, "applications"),
      where("participantId", "==", user.uid),
      where("status", "==", "진행중")
    );

    const applicationsList: any[] = [];

    const unsubWritten = onSnapshot(sellerWrittenQuery, (snapshot) => {
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (!applicationsList.find((item) => item.id === data.id)) {
          applicationsList.push(data);
        }
      });
      setApplications([...applicationsList]);
      setLoading(false);
    });

    const unsubParticipated = onSnapshot(sellerParticipatedQuery, (snapshot) => {
      snapshot.forEach((doc) => {
        const data = { id: doc.id, ...doc.data() };
        if (!applicationsList.find((item) => item.id === data.id)) {
          applicationsList.push(data);
        }
      });
      setApplications([...applicationsList]);
      setLoading(false);
    });

    return () => {
      unsubWritten();
      unsubParticipated();
    };
  }, [user]);

  if (loading) return <p className="p-4">로딩 중...</p>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">🟢 판매자 진행중 거래</h1>

      {applications.length === 0 ? (
        <p className="text-gray-600">진행중인 거래가 없습니다.</p>
      ) : (
        applications.map((app) => (
          <Link
            href={`/inprogress/seller/${app.id}`}
            key={app.id}
            className="block border rounded p-3 hover:bg-gray-50 transition"
          >
            <p>
              {app.item} 진행중 {app.quantity}개 개당 {app.unitPrice?.toLocaleString()}원
              {app.priceIfConnected && ` (접속시 ${app.priceIfConnected.toLocaleString()}원)`}
            </p>
          </Link>
        ))
      )}
    </div>
  );
}
