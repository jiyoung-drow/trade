"use client";

import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  or,
  and,
  Timestamp,
} from "firebase/firestore";
import { getAuth, signOut as firebaseSignOut } from "firebase/auth";
import { db } from "@/lib/firebase";
import TabBar from "@/components/TabBar";

interface SavedInfo {
  id: string;
  name: string; // 은행명
  value: string; // 계좌번호
  accountHolder: string; // 예금주명 추가
  userId: string;
  createdAt?: Timestamp;
}

interface Application {
  id: string;
  role: "buyer" | "seller";
  participants?: string[];
  itemType?: string;
  status?: string;
  fishName?: string;
  quantity?: number;
  remainingQuantity?: number;
  unitPrice?: number;
  altUnitPrice?: number;
  uid?: string;
  todayOrTomorrow?: "today" | "tomorrow";
  approved?: boolean;
  rejected?: boolean;
  closed?: boolean;
  createdAt?: Timestamp;
  sellerEntries?: any[];
  needsAdmin?: boolean;
  settled?: boolean;
  sellerParticipations?: { [uid: string]: number };
}

export default function SellerMyPage() {
  const { data: session, status } = useSession();
  const [savedInfos, setSavedInfos] = useState<SavedInfo[]>([]);
  const [linkName, setLinkName] = useState(""); // 은행명
  const [linkValue, setLinkValue] = useState(""); // 계좌번호
  const [accountHolder, setAccountHolder] = useState(""); // 예금주명 상태 추가
  const [loading, setLoading] = useState(false);
  const [rejectedApplications, setRejectedApplications] = useState<Application[]>([]);
  const [adminLink, setAdminLink] = useState<string | null>(null);
  const router = useRouter();
  const userId = session?.user?.id;

  useEffect(() => {
    if (status === "authenticated" && userId) {
      fetchInfos(userId);
      fetchRejectedApplications(userId);
      fetchAdminLink();
    }
  }, [status, userId]);

  const fetchInfos = async (uid: string) => {
    try {
      const q = query(collection(db, "saved_infos"), where("userId", "==", uid));
      const snap = await getDocs(q);
      const data = snap.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<SavedInfo, "id">),
      }));
      setSavedInfos(data);
    } catch (err) {
      console.error("❌ 계좌 정보 불러오기 실패:", err);
    }
  };

  const fetchRejectedApplications = async (uid: string) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "applications"),
        and(
          where("rejected", "==", true),
          or(
            where("uid", "==", uid),
            where("participants", "array-contains", uid)
          )
        )
      );
      const snap = await getDocs(q);
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Application));
      setRejectedApplications(data);
    } catch (err) {
      console.error("❌ 거절된 신청서 불러오기 실패:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminLink = async () => {
    try {
      const adminLinkDocRef = doc(db, "config", "support");
      const docSnap = await getDoc(adminLinkDocRef);

      if (docSnap.exists() && docSnap.data()?.link) {
        setAdminLink(docSnap.data().link);
      } else {
        console.log("관리자 링크 (고객센터 링크)를 찾을 수 없습니다.");
        setAdminLink(null);
      }
    } catch (err) {
      console.error("❌ 관리자 링크 (고객센터 링크) 불러오기 실패:", err);
      setAdminLink(null);
    }
  };

  const handleSave = async () => {
    if (!linkName.trim() || !linkValue.trim() || !accountHolder.trim() || !userId) return; // 예금주명 유효성 검사 추가
    if (savedInfos.length > 0) {
      alert("계좌 정보는 한 개만 저장할 수 있습니다.");
      return;
    }

    setLoading(true);
    try {
      await addDoc(collection(db, "saved_infos"), {
        userId,
        name: linkName.trim(), // 은행명
        value: linkValue.trim(), // 계좌번호
        accountHolder: accountHolder.trim(), // 예금주명 저장
        createdAt: serverTimestamp(),
      });

      setLinkName("");
      setLinkValue("");
      setAccountHolder(""); // 예금주명 초기화
      await fetchInfos(userId);
    } catch (error) {
      console.error("❌ 저장 실패:", error);
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!userId) return;
    setLoading(true);
    try {
      const docRef = doc(db, "saved_infos", id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().userId === userId) {
        await deleteDoc(docRef);
        await fetchInfos(userId);
      } else {
        alert("해당 계좌 정보를 삭제할 권한이 없습니다.");
      }
    } catch (error) {
      console.error("❌ 삭제 실패:", error);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    try {
      const firebaseAuth = getAuth();
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
        console.log("✅ Firebase 로그아웃 완료");
      }
      await signOut({ redirect: false });
      window.location.href = "/";
    } catch (err) {
      console.error("❌ 로그아웃 실패:", err);
    }
  };

  const formatAppLine = (app: Application) => {
    const unit = app.unitPrice ?? 0;
    const alt = app.altUnitPrice ?? 0;
    const originalQuantity = app.quantity ?? 0;
    
    let displayContent = "";
    let rolePrefix = "";

    if (app.itemType === "물고기") {
      displayContent = `물고기 ${app.fishName || '알 수 없음'}`;
    } else if (app.itemType === "저금통") {
      displayContent = `저금통`;
    } else if (app.itemType === "티켓(꽃)") {
      displayContent = `티켓(꽃) ${app.status || '알 수 없음'}`;
    } else {
      displayContent = "알 수 없는 품목";
    }

    if (app.role === "buyer" && app.uid === userId) {
      rolePrefix = "[내가 신청한 구매]";
      displayContent += ` (총 ${originalQuantity}개)`;
    } else if (app.participants?.includes(userId ?? "")) {
      const participatedQuantity = app.sellerParticipations?.[userId ?? ""] || 0;
      rolePrefix = "[내가 참여한 판매]";
      displayContent += ` (내 참여: ${participatedQuantity}개)`;
    }

    let priceInfo = `${unit.toLocaleString()}원`;
    if (app.itemType === "티켓(꽃)" && alt) {
      priceInfo += ` (접속 시 ${alt.toLocaleString()}원)`;
    }

    return `${rolePrefix} ${displayContent} - ${priceInfo}`;
  };


  if (status === "loading")
    return <p className="p-4 text-center">로딩 중...</p>;
  if (!session)
    return <p className="p-4 text-center">로그인 후 이용해 주세요.</p>;

  return (
    <>
      <main className="max-w-md mx-auto p-4 space-y-6 font-sans">
        <h1 className="text-2xl font-extrabold text-center text-purple-600 mb-2">
          판매자 마이페이지
        </h1>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-800">거래용 계좌 저장</h2>
          <input
            value={linkName}
            onChange={(e) => setLinkName(e.target.value)}
            placeholder="은행명"
            className="border p-2 rounded w-full"
            disabled={loading || savedInfos.length > 0}
          />
          <input
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            placeholder="계좌번호"
            className="border p-2 rounded w-full"
            disabled={loading || savedInfos.length > 0}
          />
          <input // 예금주명 입력 필드 추가
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="예금주명"
            className="border p-2 rounded w-full"
            disabled={loading || savedInfos.length > 0}
          />
          <button
            onClick={handleSave}
            disabled={loading || savedInfos.length > 0}
            className="bg-green-500 hover:bg-green-600 text-white w-full p-2 rounded transition disabled:opacity-50"
          >
            {loading ? "저장 중..." : "저장"}
          </button>

          {savedInfos.length > 0 && (
            <div className="border p-2 rounded bg-white shadow-sm flex justify-between items-center">
              <div>
                <div className="text-sm font-semibold">
                  {savedInfos[0].name} - {savedInfos[0].accountHolder} {/* 예금주명 표시 */}
                </div>
                <div className="text-xs text-gray-500">
                  {savedInfos[0].value}
                </div>
              </div>
              <button
                onClick={() => handleDelete(savedInfos[0].id)}
                disabled={loading}
                className="text-red-500 text-sm"
              >
                삭제
              </button>
            </div>
          )}
          {savedInfos.length === 0 && !loading && (
              <p className="text-sm text-gray-500 text-center">저장된 계좌 정보가 없습니다.</p>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-red-700">거절된 내 신청서</h2>
          {loading ? (
            <p className="text-center text-gray-400">불러오는 중...</p>
          ) : rejectedApplications.length === 0 ? (
            <p className="text-center text-gray-500">거절된 신청서가 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {rejectedApplications.map((app) => (
                <div
                  key={app.id}
                  className="border p-3 rounded bg-red-50 shadow-sm border-red-500"
                >
                  <p className="text-sm font-semibold text-red-800">
                    {formatAppLine(app)}
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    신청일: {app.createdAt?.toDate().toLocaleDateString()}
                  </p>
                  <p className="text-xs text-red-600">
                    신청서 ID: {app.id}
                  </p>
                  <span className="text-red-500 text-xs font-bold mt-2 inline-block">
                    ❌ 거절됨
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-800">고객센터 링크</h2>
          {adminLink ? (
            <a
              href={adminLink}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white p-2 rounded font-semibold transition"
            >
              고객센터 이동
            </a>
          ) : (
            <p className="text-center text-gray-500 text-sm">등록된 고객센터 링크가 없습니다.</p>
          )}
        </section>

        <button
          onClick={handleLogout}
          className="w-full bg-gray-300 hover:bg-gray-400 text-sm py-2 rounded font-semibold transition"
        >
          로그아웃
        </button>
      </main>

      <TabBar />
    </>
  );
}