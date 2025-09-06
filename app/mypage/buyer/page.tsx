"use client";

import { useSession, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
  or,
  and,
  Timestamp,
} from "firebase/firestore";
import { getAuth, signOut as firebaseSignOut } from "firebase/auth";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";

// SavedInfo 인터페이스 수정 (name, value)
interface SavedInfo {
  name: string;
  value: string;
}

interface SavedInfoData {
  tradeLinks?: SavedInfo[];
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

export default function BuyerMyPage() {
  const { data: session, status } = useSession();
  const [savedInfos, setSavedInfos] = useState<SavedInfo[]>([]);
  const [linkName, setLinkName] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const [fees, setFees] = useState<Record<string, number>>({});
  const [rejectedApplications, setRejectedApplications] = useState<Application[]>([]);
  const [supportLink, setSupportLink] = useState<string | null>(null);
  const router = useRouter();
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    if (status === "authenticated" && userId) {
      fetchInfos(userId);
      fetchBalance(userId);
      fetchFeeSettings();
      fetchRejectedApplications(userId);
      fetchSupportLink();
    }
  }, [status, userId]);

  // 링크 불러오는 함수 수정
  const fetchInfos = async (uid: string) => {
    try {
      const savedInfoDocRef = doc(db, "saved_infos", uid);
      const docSnap = await getDoc(savedInfoDocRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as SavedInfoData;
        setSavedInfos(data.tradeLinks || []);
      } else {
        setSavedInfos([]);
      }
    } catch (err) {
      console.error("❌ 링크 불러오기 실패:", err);
    }
  };

  const fetchBalance = async (uid: string) => {
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        setBalance(data.balance ?? 0);
      } else {
        setBalance(0);
      }
    } catch (err) {
      console.error("❌ balance 불러오기 실패:", err);
      setBalance(0);
    }
  };

  const fetchFeeSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "admin_settings", "fee_settings"));
      if (snap.exists()) {
        setFees(snap.data() as Record<string, number>);
      }
    } catch (err) {
      console.error("❌ 수수료 설정 불러오기 실패:", err);
    }
  };

  const fetchRejectedApplications = async (uid: string) => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "applications"),
        and(
          where("rejected", "==", true),
          or(where("uid", "==", uid), where("participants", "array-contains", uid))
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

  const fetchSupportLink = async () => {
    try {
      const supportLinkDocRef = doc(db, "config", "support");
      const docSnap = await getDoc(supportLinkDocRef);

      if (docSnap.exists() && docSnap.data()?.link) {
        setSupportLink(docSnap.data().link);
      } else {
        console.log("고객센터 링크를 찾을 수 없습니다.");
        setSupportLink(null);
      }
    } catch (err) {
      console.error("❌ 고객센터 링크 불러오기 실패:", err);
      setSupportLink(null);
    }
  };

  // 링크 저장 함수 수정
  const handleSave = async () => {
    if (!linkName.trim() || !linkValue.trim() || !userId) return;

    setLoading(true);
    try {
      const savedInfoDocRef = doc(db, "saved_infos", userId);
      const docSnap = await getDoc(savedInfoDocRef);
      const newLink = { name: linkName.trim(), value: linkValue.trim() };

      if (docSnap.exists()) {
        // 문서가 존재하면 tradeLinks 배열에 새 링크 추가
        await updateDoc(savedInfoDocRef, {
          tradeLinks: arrayUnion(newLink),
        });
      } else {
        // 문서가 없으면 새로 생성하고 tradeLinks 필드 추가
        await setDoc(savedInfoDocRef, {
          tradeLinks: [newLink],
        });
      }

      setLinkName("");
      setLinkValue("");
      await fetchInfos(userId);
    } catch (error) {
      console.error("❌ 저장 실패:", error);
      alert("저장 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  // 링크 삭제 함수 수정
  const handleDelete = async (infoToDelete: SavedInfo) => {
    if (!userId) return;
    setLoading(true);
    try {
      const savedInfoDocRef = doc(db, "saved_infos", userId);
      await updateDoc(savedInfoDocRef, {
        tradeLinks: arrayRemove(infoToDelete),
      });
      await fetchInfos(userId);
    } catch (error) {
      console.error("❌ 삭제 실패:", error);
      alert("삭제 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const handleOpenSupportLink = () => {
    if (!supportLink) return;
    const url = supportLink.startsWith("http") ? supportLink : `https://${supportLink}`;
    try {
      new URL(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert("유효한 URL을 입력하세요.");
    }
  };

  const handleLogout = async () => {
    try {
      const firebaseAuth = getAuth();
      if (firebaseAuth.currentUser) {
        await firebaseSignOut(firebaseAuth);
      }
      await signOut({ redirect: false });
      window.location.href = "/";
    } catch (err) {
      console.error("❌ 로그아웃 실패:", err);
    }
  };

  const formatAppLine = (app: Application) => {
    const unitPrice = app.unitPrice ?? 0;
    const altUnitPrice = app.altUnitPrice ?? 0;
    const quantity = app.quantity ?? 0;
    
    let displayContent = "";
    if (app.itemType === "물고기") {
      displayContent = `물고기 ${app.fishName || "알 수 없음"} ${unitPrice.toLocaleString()}원`;
    } else if (app.itemType === "저금통") {
      displayContent = `저금통 ${quantity}개 개당 ${unitPrice.toLocaleString()}원`;
    } else if (app.itemType === "티켓(꽃)") {
      displayContent = `티켓(꽃) ${app.status || "알 수 없음"} ${quantity}개 개당 ${unitPrice.toLocaleString()}원${altUnitPrice ? ` (접속 시 ${altUnitPrice.toLocaleString()}원)` : ""}`;
    } else {
      displayContent = "알 수 없는 신청서";
    }
    
    return displayContent;
  };

  if (status === "loading") return <p className="p-4 text-center">로딩 중...</p>;
  if (!session) return <p className="p-4 text-center">로그인 후 이용해 주세요.</p>;

  return (
    <>
      <main className="max-w-md mx-auto p-4 space-y-6 font-sans">
        <h1 className="text-2xl font-extrabold text-center text-pink-500 mb-2">구매자 마이페이지</h1>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <p className="text-lg font-semibold text-gray-700">보유 보증금</p>
          <p className="text-2xl font-bold text-green-600 mt-1">{balance.toLocaleString()}원</p>
        </div>

        <div className="flex gap-2 justify-center">
          <button onClick={() => router.push("/charge")} className="flex-1 bg-red-400 hover:bg-red-500 text-white py-2 rounded font-semibold shadow transition">충전하기</button>
          <button onClick={() => router.push("/withdraw")} className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-white py-2 rounded font-semibold shadow transition">출금하기</button>
        </div>

        <button
          onClick={() => router.push("/transactions")}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded font-semibold shadow transition"
        >
          보유금액 내역
        </button>

        {/* 링크 저장 섹션 */}
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-800">거래용 링크 저장</h2>
          <input value={linkName} onChange={(e) => setLinkName(e.target.value)} placeholder="링크 이름" className="border p-2 rounded w-full" disabled={loading} />
          <input value={linkValue} onChange={(e) => setLinkValue(e.target.value)} placeholder="링크" className="border p-2 rounded w-full" disabled={loading} />
          <button onClick={handleSave} disabled={loading || !linkName || !linkValue} className={`w-full p-2 rounded font-semibold transition ${loading || !linkName || !linkValue ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}>
            {loading ? "저장 중..." : "저장"}
          </button>

          <div className="space-y-1">
            {savedInfos.map((info, index) => (
              <div key={index} className="flex justify-between items-center border p-2 rounded bg-white shadow-sm">
                <div>
                  <div className="text-sm font-semibold">{info.name}</div>
                  <div className="text-xs text-gray-500">{info.value}</div>
                </div>
                <button onClick={() => handleDelete(info)} disabled={loading} className="text-red-500 text-sm">삭제</button>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-800">거절된 내 신청서</h2>
          {loading ? <p className="text-center text-gray-400">불러오는 중...</p> : rejectedApplications.length === 0 ? <p className="text-center text-gray-500">거절된 신청서가 없습니다.</p> : (
            <div className="space-y-2">
              {rejectedApplications.map((app) => (
                <div key={app.id} className="border p-3 rounded bg-white shadow-sm border-red-500">
                  <p className="text-sm font-semibold">
                    {formatAppLine(app)}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">신청일: {app.createdAt?.toDate().toLocaleDateString()}</p>
                  <p className="text-xs text-gray-500">신청서 ID: {app.id}</p>
                  <span className="text-red-500 text-xs font-bold mt-2 inline-block">❌ 거절됨</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-bold text-gray-800">고객센터 링크</h2>
          {supportLink ? (
            <button onClick={handleOpenSupportLink} className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white p-2 rounded font-semibold transition">고객센터 이동</button>
          ) : (
            <p className="text-center text-gray-500 text-sm">등록된 고객센터 링크가 없습니다.</p>
          )}
        </section>

        {Object.keys(fees).length > 0 && (
          <section className="mt-6 text-xs text-gray-500 bg-gray-50 border p-3 rounded">
            <h3 className="font-semibold mb-2 text-gray-700 text-sm">📌 수수료안내</h3>
            <ul className="space-y-1">
              {Object.entries(fees).map(([key, value]) => (
                <li key={key} className="flex justify-between">
                  <span>{key}</span>
                  <span>{value.toLocaleString()}원</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <button onClick={handleLogout} className="w-full bg-gray-300 hover:bg-gray-400 text-sm py-2 rounded font-semibold transition">로그아웃</button>
      </main>

      <TabBar />
    </>
  );
}