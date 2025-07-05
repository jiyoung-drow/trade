// app/admin/applications/page.tsx

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  collection,
  query,
  onSnapshot,
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function AdminApplicationsPage() {
  const router = useRouter();
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterItem, setFilterItem] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/admin/login");
        return;
      }

      const userDoc = await getDoc(doc(db, "users", user.uid));
      const data = userDoc.data();

      if (!data || (data.role !== "admin" && data.role !== "superadmin")) {
        alert("접근 권한이 없습니다.");
        router.push("/admin/login");
        return;
      }

      const q = query(collection(db, "applications"));
      const unsub = onSnapshot(q, (snapshot) => {
        setApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      });

      return () => unsub();
    });

    return () => unsubscribeAuth();
  }, [router]);

  const handleDelete = async (id: string, status: string) => {
    if (status === "진행중" || status === "완료") {
      alert("진행중이거나 완료된 신청서는 삭제할 수 없습니다.");
      return;
    }

    if (confirm("해당 신청서를 삭제하시겠습니까?")) {
      await deleteDoc(doc(db, "applications", id));
      alert("삭제 완료되었습니다.");
    }
  };

  const handleStatusUpdate = async (id: string, currentStatus: string) => {
    const newStatus = prompt(`새로운 상태를 입력하세요 (예: 완료, 진행중, 대기중)`, currentStatus);
    if (!newStatus) return;

    await updateDoc(doc(db, "applications", id), {
      status: newStatus,
    });

    alert(`상태가 ${newStatus}으로 변경되었습니다.`);
  };

  const filteredApplications = applications.filter((app) => {
    const statusMatch = filterStatus ? app.status === filterStatus : true;
    const itemMatch = filterItem ? app.item === filterItem : true;
    const searchMatch = searchTerm ? (app.email?.includes(searchTerm) || app.uid?.includes(searchTerm)) : true;
    return statusMatch && itemMatch && searchMatch;
  });

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-bold">📄 신청서 관리</h1>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="text"
          placeholder="이메일 또는 UID 검색"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="border rounded p-2 flex-1 min-w-[150px]"
        />
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded p-2">
          <option value="">상태 전체</option>
          <option value="대기중">대기중</option>
          <option value="진행중">진행중</option>
          <option value="완료">완료</option>
        </select>
        <select value={filterItem} onChange={(e) => setFilterItem(e.target.value)} className="border rounded p-2">
          <option value="">항목 전체</option>
          <option value="티켓">티켓</option>
          <option value="꽃">꽃</option>
          <option value="물고기">물고기</option>
        </select>
      </div>

      {filteredApplications.length === 0 ? (
        <p className="text-gray-600 mt-4">신청서가 없습니다.</p>
      ) : (
        filteredApplications.map((app) => (
          <div key={app.id} className="border rounded p-3 my-2 space-y-1">
            <p className="font-semibold">{app.item} | 수량: {app.quantity}개 | 개당 {app.unitPrice?.toLocaleString()}원</p>
            <p className="text-sm">상태: {app.status} | 작성자: {app.email || app.uid} | 참여자: {app.participantId || "없음"}</p>
            <div className="flex space-x-2 mt-1">
              <button
                onClick={() => handleStatusUpdate(app.id, app.status)}
                className="flex-1 bg-blue-500 text-white rounded p-1"
              >
                상태 변경
              </button>
              <button
                onClick={() => handleDelete(app.id, app.status)}
                className="flex-1 bg-red-500 text-white rounded p-1"
              >
                삭제
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
