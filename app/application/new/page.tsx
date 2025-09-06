"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  Timestamp,
} from "firebase/firestore";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";

interface SavedInfo {
  id: string;
  name: string;
  value: string;
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
  accountNickname?: string; // Add accountNickname to the interface
}

export default function ApplicationNewPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [itemType, setItemType] = useState("티켓(꽃)");
  const [statusOption, setStatusOption] = useState("미접"); // '낚시도움' 항목일 경우 null/빈 값으로 처리됨
  const [fishName, setFishName] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [altUnitPrice, setAltUnitPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [userRole, setUserRole] = useState<"buyer" | "seller" | null>(null);
  const [todayOrTomorrow, setTodayOrTomorrow] =
    useState<"today" | "tomorrow">("today");
  const [accountNickname, setAccountNickname] = useState(""); // New state for account nickname

  useEffect(() => {
    const fetchRole = async () => {
      if (!session?.user?.id) return;
      const userRef = doc(db, "users", session.user.id);
      const snap = await getDoc(userRef);
      const data = snap.data();
      const role = data?.role ?? "buyer"; // 기본값은 buyer로 설정
      setUserRole(role);
    };
    fetchRole();
  }, [session?.user?.id]);

  // 거래 날짜 변경 시 항목 및 관련 상태 초기화 로직
  useEffect(() => {
    if (todayOrTomorrow === "tomorrow") {
      setItemType("티켓(꽃)"); // 내일 거래일 경우 티켓(꽃)으로 강제 설정
      setStatusOption("미접"); // 티켓(꽃)의 기본 상태
      setFishName("");
      setQuantity("");
      setAltUnitPrice("");
      setAccountNickname(""); // Clear nickname on date change
    } else {
      setItemType("티켓(꽃)"); // 기본값을 티켓(꽃)으로 초기화
      setStatusOption("미접");
      setFishName("");
      setQuantity("");
      setAltUnitPrice("");
      setAccountNickname(""); // Clear nickname on date change
    }
  }, [todayOrTomorrow]);

  if (status === "loading") return <div>로딩 중...</div>;
  if (status !== "authenticated") {
    router.push("/auth/signin");
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.user?.email || !session?.user?.id || !userRole) {
      alert("로그인 정보 또는 역할이 확인되지 않았습니다.");
      return;
    }

    // Validation for accountNickname if itemType is "낚시도움"
    if (itemType === "낚시도움" && !accountNickname.trim()) {
      alert("낚시도움 신청 시 활동 닉네임(중복방지)을 입력해주세요.");
      return;
    }

    try {
      let createdAt: any = serverTimestamp(); // 기본적으로 서버 타임스탬프
      // '내일 거래' 선택 시 자정으로 설정
      if (todayOrTomorrow === "tomorrow") {
        const now = new Date();
        const tomorrowMidnight = new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate() + 1, // 내일 날짜
          0,
          0,
          0,
          0 // 자정
        );
        // 클라이언트에서 Date 객체를 Firestore Timestamp로 변환
        createdAt = Timestamp.fromDate(tomorrowMidnight); // Date 객체를 Timestamp로 변환
      }

      const newApp = {
        uid: session.user.id,
        email: session.user.email,
        role: userRole, // 사용자 역할
        itemType,
        status:
          itemType === "저금통" || itemType === "낚시도움"
            ? null
            : statusOption,
        fishName: itemType === "물고기" ? fishName : null,
        quantity:
          itemType === "물고기" || itemType === "저금통"
            ? 1 // 물고기 및 저금통은 수량 1 고정
            : Number(quantity), // 티켓(꽃)과 낚시도움은 입력된 수량 사용
        unitPrice: Number(unitPrice),
        altUnitPrice:
          itemType === "티켓(꽃)" && statusOption === "미접"
            ? Number(altUnitPrice)
            : null,
        createdAt,
        todayOrTomorrow, // 이 필드는 UI 표시용으로 그대로 저장
        approved: false,
        rejected: false,
        settled: false,
        closed: false,
        participants: [], // 참여자 배열 초기화
        accountNickname: itemType === "낚시도움" ? accountNickname.trim() : null, // Save nickname
      };

      const newDocRef = doc(collection(db, "applications"));
      await setDoc(newDocRef, newApp);

      alert("신청서가 성공적으로 등록되었습니다!");

      // ⭐⭐⭐ 리다이렉트 대신 폼 필드 초기화 ⭐⭐⭐
      setItemType("티켓(꽃)");
      setStatusOption("미접");
      setFishName("");
      setUnitPrice("");
      setAltUnitPrice("");
      setQuantity("1");
      setTodayOrTomorrow("today");
      setAccountNickname("");
      // router.push("/application/mine"); // 기존 리다이렉트 제거
    } catch (error: any) {
      console.error("신청서 등록 오류:", error);
      alert(error.message || "신청서 등록 중 오류가 발생했습니다.");
    }
  };

  const renderStatusOptions = () => {
    if (itemType === "물고기") {
      return (
        <>
          <option value="UR">UR</option>
          <option value="SSR">SSR</option>
          <option value="SR">SR</option>
        </>
      );
    } else {
      // 기본값으로 티켓(꽃)에 해당하는 옵션 (저금통, 낚시도움은 상태 없음)
      return (
        <>
          <option value="미접">미접</option>
          <option value="접속">접속</option>
        </>
      );
    }
  };

  return (
    <>
      <TabBar />
      <div className="max-w-md mx-auto p-4 space-y-4 font-sans">
        <h1 className="text-2xl font-bold text-center text-pink-500">
          신청서 작성
        </h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1 font-medium">거래 날짜</label>
            <select
              value={todayOrTomorrow}
              onChange={(e) =>
                setTodayOrTomorrow(e.target.value as "today" | "tomorrow")
              }
              className="w-full border rounded p-2"
            >
              <option value="today">오늘</option>
              <option value="tomorrow">내일</option>
            </select>
          </div>

          <div>
            <label className="block mb-1 font-medium">항목</label>
            <select
              value={itemType}
              onChange={(e) => {
                setItemType(e.target.value);
                // 항목 변경에 따른 상태 초기화 로직
                if (e.target.value === "티켓(꽃)") {
                  setStatusOption("미접");
                  setFishName("");
                  setQuantity("");
                  setAltUnitPrice("");
                  setAccountNickname(""); // Clear nickname when changing item type
                } else if (e.target.value === "물고기") {
                  setStatusOption("UR"); // 물고기 기본 상태 UR
                  setFishName("");
                  setQuantity("1"); // 물고기는 수량 1 고정
                  setAltUnitPrice("");
                  setAccountNickname(""); // Clear nickname when changing item type
                } else if (e.target.value === "저금통") {
                  setStatusOption(""); // 저금통은 상태 없음
                  setFishName("");
                  setQuantity("1"); // 저금통은 수량 1 고정
                  setAltUnitPrice("");
                  setAccountNickname(""); // Clear nickname when changing item type
                } else if (e.target.value === "낚시도움") {
                  // '낚시도움' 항목일 경우
                  setStatusOption(""); // 상태 없음
                  setFishName(""); // 물고기 이름 없음
                  setQuantity(""); // 수량 입력 가능
                  setAltUnitPrice(""); // 접속 시 가격 없음
                  // accountNickname will be set by its own input
                }
              }}
              className="w-full border rounded p-2"
              disabled={todayOrTomorrow === "tomorrow"} // '내일 거래'일 때 항목 선택 비활성화
            >
              {todayOrTomorrow === "tomorrow" ? (
                <option value="티켓(꽃)">티켓(꽃)</option>
              ) : (
                <>
                  <option value="티켓(꽃)">티켓(꽃)</option>
                  <option value="물고기">물고기</option>
                  <option value="저금통">저금통</option>
                  <option value="낚시도움">낚시도움</option>
                </>
              )}
            </select>
          </div>

          {/* 저금통 및 낚시도움일 때는 상태 선택 보이지 않도록 */}
          {itemType !== "저금통" && itemType !== "낚시도움" && (
            <div>
              <label className="block mb-1 font-medium">상태</label>
              <select
                value={statusOption}
                onChange={(e) => setStatusOption(e.target.value)}
                className="w-full border rounded p-2"
              >
                {renderStatusOptions()}
              </select>
            </div>
          )}

          {/* '물고기' 항목일 때만 물고기 이름 입력 필드 표시 */}
          {itemType === "물고기" && (
            <div>
              <label className="block mb-1 font-medium">물고기 이름</label>
              <input
                type="text"
                value={fishName}
                onChange={(e) => setFishName(e.target.value)}
                placeholder="물고기 이름 입력"
                className="w-full border rounded p-2"
                required
              />
            </div>
          )}

          {/* '낚시도움' 항목일 때만 계정 닉네임 입력 필드 표시 */}
          {itemType === "낚시도움" && (
            <div>
              <label className="block mb-1 font-medium">활동 닉네임(중복방지)</label>
              <input
                type="text"
                value={accountNickname}
                onChange={(e) => setAccountNickname(e.target.value)}
                placeholder="활동 닉네임 입력 (중복 방지)"
                className="w-full border rounded p-2"
                required // Make it required when itemType is "낚시도움"
              />
            </div>
          )}

          {/* 수량 입력 필드는 '티켓(꽃)' 또는 '낚시도움'일 때만 표시 */}
          {(itemType === "티켓(꽃)" || itemType === "낚시도움") && (
            <div>
              <label className="block mb-1 font-medium">수량</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                min={1}
                className="w-full border rounded p-2"
                required
              />
            </div>
          )}

          <div>
            <label className="block mb-1 font-medium">가격(원)</label>
            <input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
              placeholder="가격 입력"
              className="w-full border rounded p-2"
              required
            />
          </div>

          {/* '티켓(꽃)' 항목에 '미접' 상태일 때만 접속 시 가격 필드 표시 */}
          {itemType === "티켓(꽃)" && statusOption === "미접" && (
            <div>
              <label className="block mb-1 font-medium">접속 시 가격(원)</label>
              <input
                type="number"
                value={altUnitPrice}
                onChange={(e) => setAltUnitPrice(e.target.value)}
                placeholder="접속 시 가격 입력"
                className="w-full border rounded p-2"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded shadow font-semibold"
          >
            신청서 제출
          </button>
        </form>
      </div>
    </>
  );
}
