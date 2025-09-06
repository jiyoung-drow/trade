"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    runTransaction,
    collection,
    serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import TabBar from "@/components/TabBar";

interface Application {
    id: string;
    uid: string;
    email: string;
    role: "buyer" | "seller";
    itemType: string;
    status?: string | null;
    quantity: number;
    unitPrice: number;
    altUnitPrice?: number | null;
    todayOrTomorrow?: "today" | "tomorrow";
    approved: boolean;
    rejected: boolean;
    closed: boolean;
    settled: boolean;
    createdAt: Timestamp;
    participants: string[];
    tradeLink?: string;
    sellerAccount?: string;
    buyerConfirmedLink?: boolean;
    buyerRejectedLink?: boolean;
    buyerSettlementClicked?: boolean;
    sellerFinalSettlementClicked?: boolean;
    buyerReturnAmount?: number;
    sellerPaymentAmount?: number;
    adminFeeAmount?: number;
    accountNickname?: string;
    remainingQuantity?: number;
    sellerInfoProvided?: boolean;
    sellerItemInputs?: {
        nickname: string;
        time: string;
        status: "received" | "not_possible" | null;
        showManual: boolean;
    }[];
    buyerItemConfirmations?: { [key: number]: "confirmed" | "unconfirmed" | null };
    buyerItemRejectionReasons?: { [key: number]: string | null };
sellerParticipations?: Record<string, any>;
}


interface UserData {
    role: "buyer" | "seller";
    balance: number;
    uid: string;
}

interface SavedInfoData {
    tradeLinks?: { name: string; value: string }[];
}

export default function BuyerTradeDetailPage({
    params,
}: {
    params: { id: string };
}) {
    const { id } = params;
    const { data: session, status } = useSession();
    const router = useRouter();

    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<
        "buyer" | "seller" | null
    >(null);
    const [fees, setFees] = useState<Record<string, number>>({});

    const [buyerItemConfirmations, setBuyerItemConfirmations] = useState<{
        [key: number]: "confirmed" | "unconfirmed" | null;
    }>({});
    const [buyerItemRejectionReasons, setBuyerItemRejectionReasons] = useState<{
        [key: number]: string | null;
    }>({});

    const [sellerBankName, setSellerBankName] = useState("");
    const [sellerAccountNumber, setSellerAccountNumber] = useState("");
    const [sellerAccountHolder, setSellerAccountHolder] = useState("");

    const [tradeLinkInput, setTradeLinkInput] = useState("");
    const [savedTradeLinks, setSavedTradeLinks] = useState<
        { name: string; value: string }[]
    >([]);

    useEffect(() => {
        const fetchData = async () => {
            if (status === "loading" || !session?.user?.id) return;

            setLoading(true);
            try {
                const userRef = doc(db, "users", session.user.id);
                const userSnap = await getDoc(userRef);
                if (!userSnap.exists()) {
                    setError("사용자 정보를 찾을 수 없습니다.");
                    setLoading(false);
                    router.push("/role");
                    return;
                }
                const userData = userSnap.data() as UserData;
                setCurrentUserRole(userData.role);

                const savedInfoRef = doc(db, "saved_infos", session.user.id);
                const savedInfoSnap = await getDoc(savedInfoRef);
                if (savedInfoSnap.exists()) {
                    const savedInfoData = savedInfoSnap.data() as SavedInfoData;
                    setSavedTradeLinks(
                        Array.isArray(savedInfoData.tradeLinks)
                            ? savedInfoData.tradeLinks
                            : []
                    );
                } else {
                    setSavedTradeLinks([]);
                }

                const feeSnap = await getDoc(doc(db, "admin_settings", "fee_settings"));
                const fetchedFees = feeSnap.exists()
                    ? (feeSnap.data() as Record<string, number>)
                    : {};

                setFees(fetchedFees);

                const appRef = doc(db, "applications", id);
                const appSnap = await getDoc(appRef);

                if (!appSnap.exists()) {
                    setError("신청서를 찾을 수 없습니다.");
                    setLoading(false);
                    return;
                }
                const fetchedApplication = {
                    ...appSnap.data(),
                    id: appSnap.id,
                } as Application;
                setApplication(fetchedApplication);

                const initialConfirmations = fetchedApplication.buyerItemConfirmations || {};
                const initialRejections = fetchedApplication.buyerItemRejectionReasons || {};

                if (fetchedApplication.sellerItemInputs) {
                    fetchedApplication.sellerItemInputs.forEach((item, index) => {
                        if (item.status === 'not_possible' && !initialConfirmations[index]) {
                            initialConfirmations[index] = 'unconfirmed';
                            initialRejections[index] = '확인 불가';
                        }
                    });
                }

                setBuyerItemConfirmations(initialConfirmations);
                setBuyerItemRejectionReasons(initialRejections);

                const initialTradeLink = fetchedApplication.tradeLink || "";
                setTradeLinkInput(initialTradeLink);

                if (fetchedApplication.sellerAccount) {
                    const parts = fetchedApplication.sellerAccount.split(" ");
                    if (parts.length >= 3) {
                        setSellerBankName(parts[0]);
                        setSellerAccountHolder(parts[parts.length - 1]);
                        setSellerAccountNumber(parts.slice(1, -1).join(" "));
                    } else if (parts.length === 2) {
                        setSellerBankName(parts[0]);
                        setSellerAccountNumber(parts[1]);
                    } else {
                        setSellerAccountNumber(fetchedApplication.sellerAccount);
                    }
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("데이터를 불러오는 데 실패했습니다.");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, session?.user?.id, status, router]);

  const handleFinalSettlement = async () => {
    if (!application || application.settled) {
      console.log("정산 완료 상태이거나 애플리케이션 정보가 없습니다.");
      return;
    }
    
    console.log("=== 정산 시작 - 변수 확인 ===");
    console.log("현재 fees 객체:", fees);
    console.log("현재 application.itemType:", application.itemType);
    console.log("===========================");

    try {
      await runTransaction(db, async (transaction) => {
        const appRef = doc(db, "applications", application.id);
        const appSnap = await transaction.get(appRef);

        if (!appSnap.exists()) {
          throw new Error("Application document does not exist!");
        }
        const currentApplication = appSnap.data() as Application;

        if (currentApplication.settled) {
          console.log("Transaction already settled. Exiting.");
          return;
        }
        
        // 판매자가 실제로 참여한 수량을 기준으로 총 보증금을 계산합니다.
        const actualQuantity = currentApplication.sellerItemInputs?.length || 0;
        const totalGuaranteeAmount = currentApplication.unitPrice * actualQuantity;
        let totalAdminFee = 0;
        
        // 아이템 타입별 수수료를 정의합니다.
        const feeForNormal = (currentApplication.itemType === '티켓(꽃)') 
                              ? fees['미접'] || 0
                              : fees[currentApplication.itemType] || 0;
        const feeForAccess = fees['접속'] || 0;

        // 실제 참여 수량(sellerItemInputs의 길이) 만큼 반복하여 수수료를 계산합니다.
        if (currentApplication.sellerItemInputs) {
            for (let i = 0; i < currentApplication.sellerItemInputs.length; i++) {
                const sellerItem = currentApplication.sellerItemInputs[i];
                const buyerConfirmation = currentApplication.buyerItemConfirmations?.[i];
                const buyerRejectionReason = currentApplication.buyerItemRejectionReasons?.[i];

                if (sellerItem?.status === 'not_possible' || (buyerConfirmation === 'unconfirmed' && buyerRejectionReason === '확인 불가')) {
                    // 수수료 없음
                }
                else if (buyerConfirmation === 'confirmed') {
                    totalAdminFee += feeForNormal;
                }
                else if (buyerConfirmation === 'unconfirmed' && buyerRejectionReason === '접속 계정') {
                    totalAdminFee += feeForAccess;
                }
            }
        }
        
        const finalRefundAmount = totalGuaranteeAmount - totalAdminFee;

        console.log("=== 정산 계산 결과 ===");
        console.log("총 보증금:", totalGuaranteeAmount);
        console.log("총 수수료:", totalAdminFee);
        console.log("최종 환불 금액:", finalRefundAmount);
        console.log("======================");

        const buyerId = currentApplication.uid;
        if (!buyerId) {
          throw new Error("Buyer ID is missing!");
        }

        const buyerRef = doc(db, "users", buyerId);
        const buyerSnap = await transaction.get(buyerRef);

        if (!buyerSnap.exists()) {
          throw new Error("Buyer document does not exist!");
        }

        const buyerData = buyerSnap.data() as UserData;
        const newBuyerBalance = buyerData.balance + finalRefundAmount;

        transaction.update(buyerRef, { balance: newBuyerBalance });

        const transactionsRef = collection(db, "transactions");
        const newTransaction = {
            userId: buyerId,
            applicationId: currentApplication.id,
            amount: finalRefundAmount,
            type: "refund",
            description: `거래 정산 완료 (신청서 ID: ${currentApplication.id})`,
            timestamp: serverTimestamp(), // Timestamp.now() 대신 serverTimestamp() 사용
        };
        transaction.set(doc(transactionsRef), newTransaction);

        transaction.update(appRef, {
          settled: true,
          closed: true,
          status: "completed",
          buyerReturnAmount: finalRefundAmount,
          sellerPaymentAmount: totalAdminFee,
        });

        setApplication(prev => prev ? {
            ...prev,
            settled: true,
            closed: true,
            status: "completed",
            buyerReturnAmount: finalRefundAmount,
            sellerPaymentAmount: totalAdminFee
        } : null);
      });

      console.log("Transaction and balances updated successfully!");
    } catch (e) {
      console.error("Transaction failed:", e);
      setError(`정산 중 오류가 발생했습니다: ${e}`);
    }
  };
    useEffect(() => {
        const checkAndSettle = async () => {
            if (
                application &&
                application.sellerFinalSettlementClicked &&
                !application.settled
            ) {
                const appRef = doc(db, "applications", id);
                const appSnap = await getDoc(appRef);
                if (appSnap.exists()) {
                    const fetchedApp = appSnap.data() as Application;
                    if (!fetchedApp.settled) {
                        handleFinalSettlement();
                    }
                }
            }
        };
        checkAndSettle();
    }, [application, id]);

    useEffect(() => {
        if (application && !application.tradeLink && savedTradeLinks.length > 0) {
            setTradeLinkInput(savedTradeLinks[0].value);
        }
    }, [application, savedTradeLinks]);

    const isCurrentUserOwner = session?.user?.id === application?.uid;
    const isCurrentUserParticipant = application?.participants?.includes(
        session?.user?.id as string
    );

    const isRelevantBuyer =
        (isCurrentUserOwner && application?.role === "buyer") ||
        (isCurrentUserParticipant && currentUserRole === "buyer");

    const handleItemConfirmation = (
        index: number,
        status: "confirmed" | "unconfirmed"
    ) => {
        setBuyerItemConfirmations((prev) => {
            const newConfirmations = { ...prev, [index]: status };
            if (status === "confirmed") {
                setBuyerItemRejectionReasons((prevReasons) => {
                    const newReasons = { ...prevReasons };
                    delete newReasons[index];
                    return newReasons;
                });
            }
            return newConfirmations;
        });
    };

    const handleRejectionReasonSelect = (index: number, reason: string) => {
        setBuyerItemRejectionReasons((prev) => ({
            ...prev,
            [index]: reason,
        }));
    };

    const handleBuyerSettlementComplete = async () => {
        if (!application || !session?.user?.id || !isRelevantBuyer) {
            alert("정산 완료할 권한이 없습니다.");
            return;
        }

        const totalItems = application.sellerItemInputs?.length || 0;
        const confirmedItems = Object.values(buyerItemConfirmations).filter(
            (status) => status === "confirmed"
        ).length;
        const unconfirmedItems = Object.values(buyerItemConfirmations).filter(
            (status) => status === "unconfirmed"
        ).length;

        if (confirmedItems + unconfirmedItems !== totalItems) {
            alert("모든 닉네임의 확인 상태를 선택해주세요.");
            return;
        }

        const unconfirmedIndices = Object.keys(buyerItemConfirmations)
            .filter((key) => buyerItemConfirmations[Number(key)] === "unconfirmed")
            .map(Number);
        const hasUnconfirmedWithoutReason = unconfirmedIndices.some(
            (index) => !buyerItemRejectionReasons[index]
        );
        if (hasUnconfirmedWithoutReason) {
            alert("확인 불가로 선택한 닉네임의 사유를 모두 선택해주세요.");
            return;
        }

        setLoading(true);
        try {
            const appRef = doc(db, "applications", application.id);

            const isConfirmed = confirmedItems === totalItems;
            const isRejected = unconfirmedItems > 0;

            const updateData: any = {
                buyerConfirmedLink: isConfirmed,
                buyerRejectedLink: isRejected,
                buyerSettlementClicked: true,
                buyerItemConfirmations: buyerItemConfirmations,
                buyerItemRejectionReasons: buyerItemRejectionReasons,
            };

            await updateDoc(appRef, updateData);
            setApplication((prev) => (prev ? { ...prev, ...updateData } : null));

            alert("정산 확인이 완료되었습니다. 거래가 곧 정산됩니다.");
        } catch (err) {
            console.error("Error with buyer settlement:", err);
            alert("정산 확인 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyAccount = () => {
        const textToCopy = `${sellerBankName} ${sellerAccountNumber}`;
        if (textToCopy) {
            try {
                navigator.clipboard.writeText(textToCopy);
                alert("계좌 정보가 복사되었습니다!");
            } catch (err) {
                console.error("정보 복사 실패:", err);
                alert("정보 복사에 실패했습니다. 수동으로 복사해주세요.");
            }
        }
    };

    const handleSendTradeLink = async () => {
        if (!application || !session?.user?.id || !isRelevantBuyer || !tradeLinkInput) {
            alert("링크를 입력해주세요.");
            return;
        }

        setLoading(true);
        try {
            const appRef = doc(db, "applications", application.id);
            await updateDoc(appRef, {
                tradeLink: tradeLinkInput,
                status: "seller_waiting_for_info",
            });
            setApplication((prev) =>
                prev ? { ...prev, tradeLink: tradeLinkInput } : null
            );
            alert("링크가 성공적으로 전송되었습니다.");
        } catch (err) {
            console.error("Error sending trade link:", err);
            alert("링크 전송 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleLoadSavedLink = (linkValue: string) => {
        setTradeLinkInput(linkValue);
    };

    const getCurrentTradeStatusMessage = () => {
        if (!application) return "신청서 정보를 불러오는 중입니다.";
        if (application.rejected)
            return "판매자가 거절하였습니다. 확인 불가 닉네임을 캡쳐하여 고객센터로 문의주세요.";
        if (application.settled) return "거래가 완료되었습니다.";

        if (!application.tradeLink) {
            return "상품을 받을 링크를 입력해주세요.";
        }

        if (application.tradeLink && !application.sellerInfoProvided) {
            return "판매자가 물품 정보를 입력하는 것을 기다리고 있습니다.";
        }

        if (application.sellerInfoProvided && !application.buyerSettlementClicked) {
            return (
                <>
                    판매자가 보낸 닉네임 정보를 확인하고 정산하여{" "}
                    <span className="text-red-500 font-bold">입금</span>을 완료한 후
                    정산완료버튼을 눌러주세요.
                </>
            );
        }

        if (application.buyerSettlementClicked && !application.sellerFinalSettlementClicked) {
            return `정산 완료가 접수되었습니다. 판매자가 최종 확인을 완료하면 거래가 완료됩니다.`;
        }

        if (application.sellerFinalSettlementClicked) {
            return `거래가 완료되었습니다.`;
        }

        return "거래 상태를 알 수 없습니다.";
    };

    if (loading || status === "loading") {
        return (
            <div className="flex justify-center items-center min-h-screen">
                로딩 중...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                오류: {error}
            </div>
        );
    }

    if (
        !session?.user?.id ||
        !application ||
        !currentUserRole ||
        !isRelevantBuyer
    ) {
        return (
            <div className="flex justify-center items-center min-h-screen text-red-500">
                이 거래를 조회할 권한이 없거나, 올바른 구매자 역할이 아닙니다.
            </div>
        );
    }

    const hasSellerProvidedInfo = application.sellerInfoProvided;
    const buyerNeedsToSendLink = !application.tradeLink;
    const tradeIsSettled = application.settled;
    const tradeIsRejected = application.rejected;
    const buyerNeedsToSettle = hasSellerProvidedInfo && !application.buyerSettlementClicked;
    const isMijeopType = application.itemType === '미접';

    return (
        <>
            <TabBar />
            <div className="max-w-md mx-auto p-4 pt-8 pb-20 font-sans">
                <h1 className="text-2xl font-bold text-center text-blue-600 mb-6">
                    구매자 거래 상세 📄
                </h1>

                <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border border-gray-200">
                    <h2 className="text-xl font-bold mb-2 text-gray-800">
                        {application.itemType}
                        {application.rejected && " (거절됨)"}
                        {application.settled && " (완료됨)"}
                    </h2>
<p className="text-gray-700 mb-2">
  수량: {Object.values(application.sellerParticipations || {})[0] || 0}개
</p>
                    <p className="text-gray-700 mb-4">
                        가격: {application.unitPrice.toLocaleString()}원
                        {application.itemType === "티켓(꽃)" &&
                            application.altUnitPrice &&
                            application.altUnitPrice !== application.unitPrice && (
                                <span className="ml-2 text-gray-500 text-sm">
                                    (접속시 {application.altUnitPrice.toLocaleString()}원)
                                </span>
                            )}
                    </p>
                    <p className="text-lg font-bold text-center text-blue-600 mt-4 border-t pt-4">
                        {getCurrentTradeStatusMessage()}
                    </p>
                </div>

                {buyerNeedsToSendLink && !tradeIsRejected && !tradeIsSettled && (
                    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4">
                        <h3 className="text-xl font-semibold mb-4 text-blue-500">
                            구매자님 진행
                        </h3>
                        <p className="text-gray-600 mb-4">
                            상품을 받을 링크를 입력해주세요.
                        </p>
                        <div className="flex flex-col space-y-4">
                            {savedTradeLinks.length > 0 && (
                                <div className="mb-2">
                                    <p className="block text-gray-700 text-xs font-bold mb-1">
                                        내 저장된 링크 선택
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                        {savedTradeLinks.map((link, index) => (
                                            <button
                                                key={index}
                                                onClick={() => handleLoadSavedLink(link.value)}
                                                className="py-2 px-4 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm transition"
                                            >
                                                {link.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <input
                                type="text"
                                value={tradeLinkInput}
                                onChange={(e) => setTradeLinkInput(e.target.value)}
                                placeholder="거래 링크를 입력하세요"
                                className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />

                            <button
                                onClick={handleSendTradeLink}
                                disabled={!tradeLinkInput || loading}
                                className={`w-full font-bold py-3 px-4 rounded-lg transition ${
                                    tradeLinkInput
                                        ? "bg-blue-500 text-white hover:bg-blue-600"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
                            >
                                {loading ? "전송 중..." : "링크 보내기"}
                            </button>
                        </div>
                    </div>
                )}

                {buyerNeedsToSettle && !tradeIsRejected && !tradeIsSettled && (
                    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4">
                        <h3 className="text-xl font-semibold mb-4 text-blue-500">
                            구매자님 진행
                        </h3>
                        <>
                            <p className="text-lg font-bold text-gray-700 mb-4">
                                판매자 계좌 정보:
                            </p>
                            <div className="bg-gray-100 p-4 rounded-lg mb-4">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="text-gray-800 font-semibold break-all">
                                        {sellerBankName} {sellerAccountNumber}
                                    </p>
                                    <button
                                        onClick={handleCopyAccount}
                                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-1 px-3 rounded-md text-sm transition-colors"
                                    >
                                        복사
                                    </button>
                                </div>
                                <p className="text-gray-600 text-sm">
                                    예금주명: {sellerAccountHolder}
                                </p>
                            </div>

                            <div className="mb-4">
                                <p className="text-lg font-bold text-gray-700 mb-2">
                                    닉네임 확인
                                </p>
                                {application.sellerItemInputs?.map((item, index) => (
                                    <div key={index} className="flex flex-col border-b py-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex flex-col">
                                                <span className="font-semibold text-gray-800">
                                                    {index + 1}. {item.nickname}
                                                </span>
                                                {item.time && (
                                                    <span className="text-xs text-gray-500 mt-1">
                                                        시간: {item.time}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex gap-2">
                                                {item.status === 'not_possible' ? (
                                                    <>
                                                        <p className="text-red-500 font-bold text-sm">판매자 불가능</p>
                                                        <button
                                                            onClick={() => handleItemConfirmation(index, 'unconfirmed')}
                                                            className={`px-3 py-1 rounded text-sm transition bg-red-500 text-white cursor-not-allowed`}
                                                            disabled
                                                        >
                                                            확인 불가
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleItemConfirmation(index, 'confirmed')}
                                                            className={`px-3 py-1 rounded text-sm transition ${buyerItemConfirmations[index] === 'confirmed' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-green-400'}`}
                                                        >
                                                            확인 완료
                                                        </button>
                                                        <button
                                                            onClick={() => handleItemConfirmation(index, 'unconfirmed')}
                                                            className={`px-3 py-1 rounded text-sm transition ${buyerItemConfirmations[index] === 'unconfirmed' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700 hover:bg-red-400'}`}
                                                        >
                                                            확인 불가
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {buyerItemConfirmations[index] === "unconfirmed" && (
                                            <div className="mt-2 flex gap-2">
                                                {item.status !== 'not_possible' && (
                                                    <button
                                                        onClick={() => handleRejectionReasonSelect(index, "확인 불가")}
                                                        className={`px-3 py-1 rounded-full text-xs transition ${
                                                            buyerItemRejectionReasons[index] === "확인 불가"
                                                                ? "bg-red-500 text-white"
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        }`}
                                                    >
                                                        확인 불가
                                                    </button>
                                                )}
                                                {item.status === 'not_possible' && (
                                                    <span
                                                        className={`px-3 py-1 rounded-full text-xs transition bg-gray-300 text-gray-600 cursor-not-allowed`}
                                                    >
                                                        확인 불가 (판매자 불가능)
                                                    </span>
                                                )}

                                                {(isMijeopType || application.itemType === "티켓(꽃)") && item.status !== 'not_possible' && (
                                                    <button
                                                        onClick={() => handleRejectionReasonSelect(index, "접속 계정")}
                                                        className={`px-3 py-1 rounded-full text-xs transition ${
                                                            buyerItemRejectionReasons[index] === "접속 계정"
                                                                ? "bg-red-500 text-white"
                                                                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                                        }`}
                                                    >
                                                        접속 계정
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={handleBuyerSettlementComplete}
                                disabled={
                                    Object.keys(buyerItemConfirmations).length !==
                                    (application.sellerItemInputs?.length || 0) || loading
                                }
                                className={`w-full font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition ${
                                    Object.keys(buyerItemConfirmations).length ===
                                    (application.sellerItemInputs?.length || 0)
                                        ? "bg-blue-500 hover:bg-blue-600 text-white"
                                        : "bg-gray-300 text-gray-500 cursor-not-allowed"
                                }`}
                            >
                                {loading ? "처리 중..." : "정산 완료"}
                            </button>
                        </>
                    </div>
                )}

                {(tradeIsRejected || tradeIsSettled || application.buyerSettlementClicked) && (
                    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4 text-center">
                        <h3 className="text-xl font-semibold mb-4 text-gray-700">거래 상태</h3>
                        {tradeIsRejected && (
                            <p className="text-red-600 font-bold text-lg">
                                판매자가 거절하였습니다. 확인 불가 닉네임을 캡쳐하여 고객센터로
                                문의주세요.
                            </p>
                        )}
                        {tradeIsSettled && (
                            <div className="text-green-600 font-bold text-lg">
                                거래가 완료되었습니다.
                                {application.buyerReturnAmount !== undefined && (
                                    <div className="mt-2 text-gray-800 text-sm">
                                        <p>
                                            환불 금액: <span className="font-bold text-blue-500">{application.buyerReturnAmount.toLocaleString()}원</span>이 보유금액으로 지급되었습니다.
                                        </p>
                                        <div className="mt-4 p-4 border rounded-lg text-left bg-gray-50 text-gray-700">
                                            <p className="font-bold text-base mb-2">환불 내역 상세</p>
                                            <p>
  총 보증금: {application.unitPrice.toLocaleString()}원 x {application.sellerItemInputs?.length || 0}개 = <span className="font-bold">{(application.unitPrice * (application.sellerItemInputs?.length || 0)).toLocaleString()}원</span>
</p>
                                          
<ul className="list-disc list-inside mt-2">
  {application.sellerItemInputs?.map((item, index) => {
    const confirmation = application.buyerItemConfirmations?.[index];
    const rejectionReason = application.buyerItemRejectionReasons?.[index];
    let feeDescription = "";
    let feeAmount = 0;
    
    if (confirmation === 'confirmed') {
        feeAmount = fees['미접'] || 0;
        feeDescription = `(확인 완료: ${feeAmount.toLocaleString()}원 수수료 발생)`;
    } else if (rejectionReason === '접속 계정') {
        feeAmount = fees['접속'] || 0;
        feeDescription = `(확인 불가 - 접속 계정: ${feeAmount.toLocaleString()}원 수수료 발생)`;
    } else {
        feeDescription = `(확인 불가: 수수료 없음)`;
    }

    return (
      <li key={index}>
        {index + 1}. 닉네임 **{item.nickname}**: {feeDescription}
      </li>
    );
  })}
</ul>
                                            <p className="mt-2 font-bold text-gray-800">
                                                총 수수료: <span className="text-red-500">{(application.adminFeeAmount || 0).toLocaleString()}원</span>
                                            </p>
                                            <p className="mt-1 font-bold text-lg">
                                                최종 환불 금액: <span className="text-blue-500">{(application.buyerReturnAmount || 0).toLocaleString()}원</span>
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        {application.buyerSettlementClicked &&
                            !application.sellerFinalSettlementClicked && (
                                <p className="text-gray-600 font-bold text-lg">
                                    정산 완료가 접수되었습니다. 판매자가 최종 확인을 완료하면
                                    거래가 완료됩니다.
                                </p>
                            )}
                    </div>
                )}
            </div>
        </>
    );
}