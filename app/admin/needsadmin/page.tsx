// NeedsAdminPage.tsx 최종 수정본 (검색 기능 추가)
"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  DocumentData,
  doc,
  updateDoc,
  getDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";

interface Application {
  id: string;
  fishName?: string;
  itemType?: string; // "물고기", "저금통", "티켓(꽃)"
  quantity?: number; // 구매자가 최초 신청한 총 수량
  remainingQuantity?: number; // 구매자 신청서에 남은 수량
  unitPrice?: number; // 단가
  altUnitPrice?: number; // 대체 단가 (티켓(꽃)의 접속시 단가 등)
  userEmail?: string;
  uid?: string; // 구매자의 UID
  needsAdmin?: boolean;
  settled?: boolean;
  createdAt?: any;
  sellerParticipations?: { [uid: string]: number };
  approved?: boolean;
  rejected?: boolean;
  closed?: boolean;
  status?: string; // 물고기(UR/SSR/SR), 티켓(미접/접속)
}

interface FeeSettings {
  SR?: number;
  SSR?: number;
  UR?: number;
  미접?: number;
  접속?: number;
  저금통?: number;
}

export default function NeedsAdminPage() {
  const router = useRouter();
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [feeSettings, setFeeSettings] = useState<FeeSettings | null>(null);

  // 검색 기능 관련 상태
  const [searchId, setSearchId] = useState("");
  const [searchedApp, setSearchedApp] = useState<Application | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const feeSettingsRef = doc(db, "admin_settings", "fee_settings");
        const feeSnap = await getDoc(feeSettingsRef);
        if (feeSnap.exists()) {
          setFeeSettings(feeSnap.data() as FeeSettings);
        } else {
          setFeeSettings({});
        }
      } catch (feeError) {
        console.error("수수료 설정 불러오기 오류:", feeError);
        setFeeSettings({});
      }

      const q = query(
        collection(db, "applications"),
        where("needsAdmin", "==", true)
      );
      const snap = await getDocs(q);
      const list = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as DocumentData),
      })) as Application[];
      setApps(list);
      setLoading(false);
    };
    fetchData();
  }, []);

  const handleSearch = async () => {
    if (!searchId.trim()) {
      setSearchError("신청서 ID를 입력해주세요.");
      setSearchedApp(null);
      return;
    }

    setSearchLoading(true);
    setSearchError("");
    setSearchedApp(null);

    try {
      const appDocRef = doc(db, "applications", searchId.trim());
      const appSnap = await getDoc(appDocRef);

      if (appSnap.exists()) {
        const appData = {
          id: appSnap.id,
          ...(appSnap.data() as DocumentData),
        } as Application;
        // 검색된 신청서가 'needsAdmin' 상태인지 확인
        if (appData.needsAdmin) {
          setSearchedApp(appData);
        } else {
          setSearchError("해당 신청서는 관리자 개입이 필요하지 않은 상태입니다.");
        }
      } else {
        setSearchError("해당 신청서를 찾을 수 없습니다.");
      }
    } catch (error) {
      console.error("신청서 검색 중 오류 발생:", error);
      setSearchError("신청서 검색 중 오류가 발생했습니다.");
    }
    setSearchLoading(false);
  };

  const handleConfirmedReturn = async (appId: string, app: Application) => {
    if (!app.uid) {
      alert("구매자 UID를 찾을 수 없어 보증금을 반환할 수 없습니다.");
      return;
    }
    if (feeSettings === null) {
      alert("수수료 설정이 로드되지 않았습니다. 잠시 후 다시 시도해주세요.");
      return;
    }

    const quantity = app.quantity ?? 0;
    let totalAmountToReturn = 0;
    let totalFixedFee = 0;

    if (app.itemType === "티켓(꽃)") {
      const connectedQuantityStr = prompt(`'${app.itemType}' 총 ${quantity}개 중 접속으로 확인된 수량을 입력해주세요.`, "0");
      if (connectedQuantityStr === null) return;
      const connectedQuantity = parseInt(connectedQuantityStr, 10);

      if (isNaN(connectedQuantity) || connectedQuantity < 0 || connectedQuantity > quantity) {
        alert("유효한 수량을 입력해주세요.");
        return;
      }
      const disconnectedQuantity = quantity - connectedQuantity;
      const altUnitPrice = app.altUnitPrice ?? 0;
      const unitPrice = app.unitPrice ?? 0;
      const connectedAmount = connectedQuantity * altUnitPrice;
      const disconnectedAmount = disconnectedQuantity * unitPrice;
      const connectedFee = (feeSettings.접속 ?? 0);
      const disconnectedFee = (feeSettings.미접 ?? 0);

      totalAmountToReturn = connectedAmount + disconnectedAmount;
      totalFixedFee = (connectedFee * connectedQuantity) + (disconnectedFee * disconnectedQuantity);

    } else if (app.itemType === "물고기" && app.status) {
      const unitPrice = app.unitPrice ?? 0;
      totalAmountToReturn = quantity * unitPrice;
      totalFixedFee = (feeSettings[app.status as keyof FeeSettings] ?? 0) * quantity;
    } else if (app.itemType === "저금통") {
      const unitPrice = app.unitPrice ?? 0;
      totalAmountToReturn = quantity * unitPrice;
      totalFixedFee = (feeSettings.저금통 ?? 0) * quantity;
    }

    const finalAmountToReturn = Math.max(0, totalAmountToReturn - totalFixedFee);

    const confirmReturn = window.confirm(
      `[확인됨 처리]\n` +
      `총 반환 대상 금액: ${totalAmountToReturn.toLocaleString()}원\n` +
      `총 적용 수수료: ${totalFixedFee.toLocaleString()}원\n` +
      `최종 반환 금액: ${finalAmountToReturn.toLocaleString()}원\n\n` +
      `진행하시겠습니까?`
    );

    if (!confirmReturn) return;

    await updateDepositAndApplication(appId, app.uid, finalAmountToReturn, "approved");
  };

  const handleUnconfirmedReturn = async (appId: string, app: Application) => {
    if (!app.uid) {
      alert("구매자 UID를 찾을 수 없어 보증금을 반환할 수 없습니다.");
      return;
    }
    const finalAmountToReturn = (app.quantity ?? 0) * (app.unitPrice ?? 0);
    const confirmReturn = window.confirm(
      `[확인 안 됨 처리]\n` +
      `이 신청서의 보증금 ${finalAmountToReturn.toLocaleString()}원을 수수료 차감 없이 구매자에게 반환합니다.\n\n` +
      `진행하시겠습니까?`
    );
    if (!confirmReturn) return;
    await updateDepositAndApplication(appId, app.uid, finalAmountToReturn, "rejected");
  };

  const updateDepositAndApplication = async (
    appId: string,
    buyerUid: string,
    amount: number,
    status: "approved" | "rejected"
  ) => {
    try {
      const buyerRef = doc(db, "users", buyerUid);
      const buyerSnap = await getDoc(buyerRef);
      if (!buyerSnap.exists()) {
        alert("구매자 정보를 찾을 수 없습니다.");
        return;
      }

      const buyerData = buyerSnap.data();
      const currentBuyerDeposit = typeof buyerData?.deposit === 'number' ? buyerData.deposit : 0;
      const newBuyerDeposit = currentBuyerDeposit + amount;

      await updateDoc(buyerRef, { deposit: newBuyerDeposit });
      const appRef = doc(db, "applications", appId);
      const updateData: Partial<Application> = {
        needsAdmin: false,
        closed: true,
      };

      if (status === "approved") {
        updateData.approved = true;
      } else {
        updateData.rejected = true;
      }

      await updateDoc(appRef, updateData);
      alert(
        `✅ 구매자에게 ${amount.toLocaleString()}원이 성공적으로 반환되었습니다.\n` +
        `신청서가 관리 목록에서 제거됩니다.`
      );
      setApps((prevApps) => prevApps.filter((a) => a.id !== appId));
      setSearchedApp(null); // 검색된 신청서도 초기화
    } catch (error) {
      console.error("보증금 반환 중 오류 발생:", error);
      alert("보증금 반환 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const formatApplicationInfo = (app: Application) => {
    let info = "";
    if (app.itemType === "물고기") {
      info = `물고기 ${app.fishName || '알 수 없음'} (${app.status || ''})`;
    } else if (app.itemType === "저금통") {
      info = `저금통`;
    } else if (app.itemType === "티켓(꽃)") {
      info = `티켓(꽃) (${app.status || ''})`;
    }
    return `${info}: ${app.quantity}개, 개당 ${app.unitPrice?.toLocaleString()}원`;
  };

  return (
    <main className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold text-center mb-4 text-red-500">
        승인 불가 신청서 관리
      </h1>

      <section className="mb-6 border p-4 rounded-lg shadow-md bg-gray-50">
        <h2 className="text-lg font-bold text-gray-700 mb-2">신청서 ID로 찾기</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
            placeholder="신청서 ID를 입력하세요"
            className="flex-1 border p-2 rounded-md"
          />
          <button
            onClick={handleSearch}
            disabled={searchLoading}
            className="bg-blue-500 text-white p-2 rounded-md hover:bg-blue-600 transition"
          >
            {searchLoading ? "검색 중..." : "검색"}
          </button>
        </div>
        {searchError && <p className="text-red-500 text-sm mt-2">{searchError}</p>}
      </section>

      {/* 검색 결과 표시 */}
      {searchedApp && (
        <section className="mb-6 border p-4 rounded-lg shadow-md bg-white border-blue-500">
          <h2 className="text-lg font-bold text-blue-700 mb-2">검색 결과</h2>
          <li className="border p-3 rounded shadow-sm bg-gray-50 space-y-1">
            <p className="text-sm text-gray-800">
              <strong>품목:</strong> {formatApplicationInfo(searchedApp)}
            </p>
            <p className="text-sm text-gray-600">
              <strong>구매자 이메일:</strong> {searchedApp.userEmail || "(미기록)"}
            </p>
            <p className="text-sm text-gray-600">
              <strong>구매자 UID:</strong> {searchedApp.uid}
            </p>
            <div className="flex flex-col gap-2 mt-3">
              <div className="flex gap-2">
                <button
                  onClick={() => handleConfirmedReturn(searchedApp.id, searchedApp)}
                  className="flex-1 bg-green-500 text-white text-sm py-1 rounded hover:bg-green-600 transition"
                >
                  신청서 확인됨
                </button>
                <button
                  onClick={() => handleUnconfirmedReturn(searchedApp.id, searchedApp)}
                  className="flex-1 bg-red-500 text-white text-sm py-1 rounded hover:bg-red-600 transition"
                >
                  신청서 확인 안 됨
                </button>
              </div>
            </div>
          </li>
        </section>
      )}

      {/* 관리자 개입이 필요한 신청서 목록 */}
      <section>
        <h2 className="text-lg font-bold text-gray-700 mb-2">
          관리자 개입이 필요한 신청서 목록
        </h2>
        {loading ? (
          <p className="text-center text-gray-500">불러오는 중...</p>
        ) : apps.length === 0 ? (
          <p className="text-center text-gray-400">필요한 신청서가 없습니다.</p>
        ) : (
          <ul className="space-y-4">
            {apps.map((app) => (
              <li
                key={app.id}
                className="border p-3 rounded shadow-sm bg-white space-y-1"
              >
                <p className="text-sm text-gray-800">
                  <strong>품목:</strong> {formatApplicationInfo(app)}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>구매자 이메일:</strong> {app.userEmail || "(미기록)"}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>구매자 UID:</strong> {app.uid}
                </p>
                <div className="flex flex-col gap-2 mt-3">
                  <button
                    onClick={() => router.push(`/admin/application/${app.id}`)}
                    className="w-full bg-blue-500 text-white text-sm py-1 rounded hover:bg-blue-600 transition"
                  >
                    상세 보기
                  </button>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirmedReturn(app.id, app)}
                      className="flex-1 bg-green-500 text-white text-sm py-1 rounded hover:bg-green-600 transition"
                    >
                      신청서 확인됨
                    </button>
                    <button
                      onClick={() => handleUnconfirmedReturn(app.id, app)}
                      className="flex-1 bg-red-500 text-white text-sm py-1 rounded hover:bg-red-600 transition"
                    >
                      신청서 확인 안 됨
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}