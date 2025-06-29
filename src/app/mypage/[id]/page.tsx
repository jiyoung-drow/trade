"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [application, setApplication] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const fetchApplication = async () => {
      if (!id) return;
      const docRef = doc(db, "applications", id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        setApplication(docSnap.data());
      } else {
        alert("신청서를 찾을 수 없습니다.");
        router.push("/mypage");
      }
    };

    fetchApplication();
  }, [id, router]);

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      const docRef = doc(db, "applications", id);
      await updateDoc(docRef, { status: newStatus });
      alert(`상태가 '${newStatus}'로 업데이트되었습니다.`);
      router.push("/mypage");
    } catch (error) {
      console.error(error);
      alert("상태 업데이트 실패. 다시 시도해주세요.");
    }
  };

  if (!application) {
    return <div className="p-4">로딩 중...</div>;
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-2xl font-bold mb-4">거래 신청서 상세</h1>
      <p>닉네임: {application.nickname}</p>
      <p>가격: {application.price}원</p>
      <p>수량: {application.quantity}</p>
      <p>역할: {application.role}</p>
      <p>상태: {application.status}</p>
      <div className="flex gap-4 mt-4">
        <button
          onClick={() => handleStatusUpdate("승인")}
          className="bg-green-500 text-white p-2 rounded hover:bg-green-600"
        >
          승인
        </button>
        <button
          onClick={() => handleStatusUpdate("반려")}
          className="bg-red-500 text-white p-2 rounded hover:bg-red-600"
        >
          반려
        </button>
      </div>
    </div>
  );
}
