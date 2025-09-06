// app/admin/applications/page.tsx

"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
import { collection, getDocs, Timestamp } from "firebase/firestore";

interface Application {
  id: string;
  uid: string;
  role: "buyer" | "seller";
  email: string;
  itemType?: string;
  fishName?: string;
  quantity?: number;
  unitPrice?: number;
  altUnitPrice?: number;
  createdAt?: Timestamp;
  approved?: boolean;
  rejected?: boolean;
  settled?: boolean; // settled 필드 추가
  participants?: string[];
  sellerItemInputs?: {
    nickname: string;
    status: "received" | "not_possible" | null;
  }[];
}

export default function AdminApplicationsPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [allApps, setAllApps] = useState<Application[]>([]);
  const [filteredApps, setFilteredApps] = useState<Application[]>([]);

  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"new" | "old">("new");
  const [roleFilter, setRoleFilter] = useState<"all" | "buyer" | "seller">(
    "all"
  );
  const [typeFilter, setTypeFilter] = useState<
    "all" | "물고기" | "저금통" | "티켓(꽃)" | "기타" | "미접" | "낚시도움"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "waiting" | "inprogress" | "completed" | "rejected"
  >("all");

  useEffect(() => {
    if (!session?.user?.email) return;
    if (session.user.email !== "shepollux@gmail.com") {
      alert("관리자만 접근할 수 있습니다.");
      router.push("/");
      return;
    }

    const fetchApplications = async () => {
      const snap = await getDocs(collection(db, "applications"));
      const data = snap.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          ...d,
          email: d.email ?? "unknown",
        } as Application;
      });
      setAllApps(data);
    };

    fetchApplications();
  }, [session?.user?.email, router]);

  useEffect(() => {
    let result = [...allApps];

    if (search.trim()) {
      result = result.filter((a) =>
        a.email.toLowerCase().includes(search.trim().toLowerCase())
      );
    }

    if (roleFilter !== "all") {
      result = result.filter((a) => a.role === roleFilter);
    }

    if (typeFilter !== "all") {
      result = result.filter((a) => a.itemType === typeFilter);
    }

    // ✅ 상태 필터링 로직 수정
    if (statusFilter !== "all") {
      result = result.filter((a) => {
        if (statusFilter === "completed") return a.settled;
        if (statusFilter === "rejected") return a.rejected;
        if (statusFilter === "inprogress") return a.approved && !a.rejected && !a.settled;
        if (statusFilter === "waiting") return !a.approved && !a.rejected;
        return true;
      });
    }

    result.sort((a, b) => {
      const timeA = a.createdAt?.toDate().getTime() ?? 0;
      const timeB = b.createdAt?.toDate().getTime() ?? 0;
      return sortOrder === "new" ? timeB - timeA : timeA - timeB;
    });

    setFilteredApps(result);
  }, [search, sortOrder, roleFilter, typeFilter, statusFilter, allApps]);

  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch("/api/admin/delete-application", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      if (!res.ok) throw new Error("삭제 실패");

      alert("삭제되었습니다.");
      setAllApps((prev) => prev.filter((app) => app.id !== id));
      setFilteredApps((prev) => prev.filter((app) => app.id !== id));
    } catch (error) {
      alert("삭제 중 오류가 발생했습니다.");
      console.error("삭제 오류:", error);
    }
  };

  const formatDate = (ts?: Timestamp) => {
    if (!ts) return "";
    const date = ts.toDate();
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const formatSummary = (app: Application) => {
    const type = app.itemType ?? "";
    const quantity = app.quantity ?? 0;
    const unit = app.unitPrice?.toLocaleString() ?? "0";
    const alt = app.altUnitPrice?.toLocaleString();
    const fish = app.fishName ?? "";

    switch (type) {
      case "물고기":
        return `물고기: ${fish} (${unit}원)`;
      case "저금통":
        return `저금통: ${quantity}개 (${unit}원)`;
      case "티켓(꽃)":
        return `티켓(꽃): ${quantity}개 (${unit}원${alt ? ` / 접속시 ${alt}원` : ''})`;
      case "미접":
        return `미접: ${quantity}개 (${unit}원${alt ? ` / 접속시 ${alt}원` : ''})`;
      case "낚시도움":
        return `낚시도움: ${quantity}개 (${unit}원)`;
      default:
        return `기타: ${quantity}개 (${unit}원)`;
    }
  };

  // ✅ 상태 태그 반환 로직 수정
  const getStatusTag = (app: Application) => {
    if (app.settled) return "완료";
    if (app.rejected) return "거절됨";
    if (app.approved) return "거래중";
    return "대기중";
  };

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4 font-sans">
      <h1 className="text-xl font-bold text-center">전체 신청서 관리</h1>

      {/* 🔍 검색 및 필터 */}
      <div className="flex flex-col md:flex-row md:items-center md:space-x-3 space-y-2 md:space-y-0">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="이메일 검색"
          className="border px-2 py-1 rounded w-full md:w-60"
        />
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as "new" | "old")}
          className="border px-2 py-1 rounded"
        >
          <option value="new">최신순</option>
          <option value="old">오래된순</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as any)}
          className="border px-2 py-1 rounded"
        >
          <option value="all">전체 역할</option>
          <option value="buyer">구매자</option>
          <option value="seller">판매자</option>
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as any)}
          className="border px-2 py-1 rounded"
        >
          <option value="all">전체 유형</option>
          <option value="물고기">물고기</option>
          <option value="저금통">저금통</option>
          <option value="티켓(꽃)">티켓(꽃)</option>
          <option value="미접">미접</option>
          <option value="낚시도움">낚시도움</option>
          <option value="기타">기타</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="border px-2 py-1 rounded"
        >
          <option value="all">전체 상태</option>
          <option value="waiting">대기중</option>
          <option value="inprogress">거래중</option>
          <option value="completed">거래완료</option>
          <option value="rejected">거절됨</option>
        </select>
      </div>

      {filteredApps.length === 0 ? (
        <p className="text-center text-gray-500">
          조건에 맞는 신청서가 없습니다.
        </p>
      ) : (
        <div className="space-y-3 mt-3">
          {filteredApps.map((app) => (
            <div
              key={app.id}
              className="border rounded p-3 bg-white shadow-sm text-sm flex justify-between items-start"
            >
              <div>
                <p className="font-medium">
                  [{getStatusTag(app)}] {app.email} (
                  {app.role === "buyer" ? "구매자" : "판매자"})
                </p>
                <p className="text-gray-700">
                  ({formatDate(app.createdAt)}) - {formatSummary(app)}
                </p>
              </div>
              <button
                onClick={() => handleDelete(app.id)}
                className="text-red-600 text-xs border border-red-400 px-2 py-0.5 rounded hover:bg-red-50"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}