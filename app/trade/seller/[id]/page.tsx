"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
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
    sellerItemInputs?: { nickname: string; time: string; status: 'received' | 'not_possible' | null; showManual: boolean }[];
    buyerItemConfirmations?: { [key: number]: 'confirmed' | 'unconfirmed' | null };
    buyerItemRejectionReasons?: { [key: number]: string };
    sellerParticipations?: { [key: string]: number };
}

interface UserData {
    role: "buyer" | "seller";
    balance: number;
    uid: string;
}

interface SavedInfo {
    id: string;
    name: string;
    value: string;
    accountHolder: string;
    userId: string;
}

export default function SellerTradeDetailPage({ params }: { params: { id: string } }) {
    const { id } = params;
    const { data: session, status } = useSession();
    const router = useRouter();

    const [application, setApplication] = useState<Application | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentUserRole, setCurrentUserRole] = useState<"buyer" | "seller" | null>(null);
    const [fees, setFees] = useState<Record<string, number>>({});
    const [savedAccounts, setSavedAccounts] = useState<SavedInfo[]>([]);

    const [sellerAccountInfo, setSellerAccountInfo] = useState({
        bankName: "",
        accountNumber: "",
        accountHolder: "",
    });

    const [sellerItemInputs, setSellerItemInputs] = useState<{ nickname: string; time: string; status: 'received' | 'not_possible' | null; showManual: boolean }[]>([]);

    const isRelevantSeller = (application?.participants?.includes(session?.user?.id as string) && currentUserRole === "seller") || (session?.user?.id === application?.uid && application?.role === "seller");
    const hasBuyerProvidedInfo = application?.tradeLink;
    const hasSellerAllInfoProvided = application?.sellerInfoProvided;
    const buyerSettlementClicked = application?.buyerSettlementClicked;

    const fetchData = useCallback(async () => {
        if (status === "loading" || !session?.user?.id) return;

        setLoading(true);
        try {
            const userRef = doc(db, "users", session.user.id);
            const userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
                setError("사용자 정보를 찾을 수 없습니다.");
                router.push("/role");
                return;
            }
            const userData = userSnap.data() as UserData;
            setCurrentUserRole(userData.role);

            await fetchFeeSettings();

            const savedInfosQuery = query(
                collection(db, "saved_infos"),
                where("userId", "==", session.user.id)
            );
            const savedInfosSnap = await getDocs(savedInfosQuery);
            const fetchedSavedInfos: SavedInfo[] = savedInfosSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            })) as SavedInfo[];
            setSavedAccounts(fetchedSavedInfos);

            const appRef = doc(db, "applications", id);
            const appSnap = await getDoc(appRef);

            if (!appSnap.exists()) {
                setError("신청서를 찾을 수 없습니다.");
                return;
            }
            const fetchedApplication = { ...appSnap.data(), id: appSnap.id } as Application;
            
            const myQuantity = fetchedApplication.sellerParticipations?.[session.user.id] || fetchedApplication.quantity;
            
            setApplication(fetchedApplication);
            
            if (fetchedApplication.sellerAccount) {
                const parts = fetchedApplication.sellerAccount.split(" ");
                setSellerAccountInfo({
                    bankName: parts[0] || "",
                    accountNumber: parts[1] || "",
                    accountHolder: parts[2] || "",
                });
            }

            if (fetchedApplication.sellerItemInputs && fetchedApplication.sellerItemInputs.length > 0) {
                setSellerItemInputs(fetchedApplication.sellerItemInputs);
            } else {
                setSellerItemInputs(Array.from({ length: myQuantity }, () => ({
                    nickname: "",
                    time: "",
                    status: 'received',
                    showManual: false,
                })));
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            setError("데이터를 불러오는 데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    }, [id, session?.user?.id, status, router]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const fetchFeeSettings = async () => {
        try {
            const snap = await getDoc(doc(db, "admin_settings", "fee_settings"));
            if (snap.exists()) {
                setFees(snap.data() as Record<string, number>);
            } else {
                console.log("admin_settings/fee_settings 문서가 존재하지 않습니다.");
            }
        } catch (err) {
            console.error("❌ 수수료 설정 불러오기 실패:", err);
        }
    };

    const getCurrentTradeStatusMessage = () => {
        if (!application) return "신청서 정보를 불러오는 중입니다.";
        if (application.rejected) return "거절되었습니다. 고객센터로 문의 주세요.";
        if (application.settled) return `거래가 완료되었습니다.`;
        if (!hasBuyerProvidedInfo) return "구매자가 물품 수령 링크를 입력하는 것을 기다리고 있습니다.";
        if (hasBuyerProvidedInfo && !hasSellerAllInfoProvided) return `닉네임, 시간, 계좌 정보를 입력해주세요.`;
        if (hasSellerAllInfoProvided && !buyerSettlementClicked) return `구매자의 정산 확인을 기다리는 중입니다.`;
        if (buyerSettlementClicked && !application.sellerFinalSettlementClicked) return `구매자 확인이 완료되었습니다. 최종 정산 여부를 결정해 주세요.`;
        if (application.sellerFinalSettlementClicked) return `판매자가 최종 정산을 완료했습니다.`;
        return "거래 상태를 알 수 없습니다.";
    };

    const getApplicationTitleStatus = () => {
        if (!application) return "";
        if (application.rejected) return "(거절됨)";
        if (application.settled) return "(완료됨)";
        return "";
    };

    const handleSellerApprove = async () => {
        if (!application || !session?.user?.id || !isRelevantSeller) {
            alert("최종 정산할 권한이 없습니다.");
            return;
        }

        setLoading(true);
        try {
            await runTransaction(db, async (transaction) => {
                const appRef = doc(db, 'applications', application.id);
                const feeSettingsRef = doc(db, 'admin_settings', 'fee_settings');
                const buyerRef = doc(db, 'users', application.uid);
                const transactionsRef = collection(db, "transactions");

                const [appDoc, feeSettingsDoc, buyerDoc] = await Promise.all([
                    transaction.get(appRef),
                    transaction.get(feeSettingsRef),
                    transaction.get(buyerRef)
                ]);

                if (!appDoc.exists() || !feeSettingsDoc.exists() || !buyerDoc.exists()) {
                    console.error('필요한 문서를 찾을 수 없습니다.');
                    return;
                }

                const appData = appDoc.data() as Application;
                const feesData = feeSettingsDoc.data() as { [key: string]: number };
                const buyerData = buyerDoc.data() as UserData;

                if (appData.settled) {
                    console.log('이미 정산된 건입니다. 작업을 중단합니다.');
                    return;
                }

                // 1. 총 수수료 합산 (닉네임 수만큼 계산)
                let totalAdminFee = 0;
                let totalSellerPaymentAmount = 0;
                
                if (appData.sellerItemInputs) {
                    appData.sellerItemInputs.forEach((item, index) => {
                        const confirmationStatus = appData.buyerItemConfirmations?.[index];
                        const rejectionReason = appData.buyerItemRejectionReasons?.[index];
                        const unitPrice = appData.unitPrice;

                        let feeForThisItem = 0;
                        let amountForSeller = 0;

                        if (confirmationStatus === 'confirmed') {
                            feeForThisItem = (appData.itemType === '티켓(꽃)')
                                ? feesData['미접'] || 0
                                : feesData[appData.itemType] || 0;
                            amountForSeller = unitPrice - feeForThisItem;
                        } else if (confirmationStatus === 'unconfirmed') {
                            if (rejectionReason === '접속 계정') {
                                feeForThisItem = feesData['접속'] || 0;
                                amountForSeller = unitPrice - feeForThisItem;
                            } else {
                                feeForThisItem = 0;
                                amountForSeller = 0;
                            }
                        }

                        totalAdminFee += feeForThisItem;
                        totalSellerPaymentAmount += amountForSeller;
                    });
                }
                
                // 2. 총 보증금 및 최종 환불 금액 계산
                const actualQuantity = appData.sellerItemInputs?.length || 0;
                const totalGuaranteeAmount = appData.unitPrice * actualQuantity;
                const finalRefundAmount = totalGuaranteeAmount - totalAdminFee;

                // 3. 파이어베이스 문서 업데이트
                transaction.update(appRef, {
                    settled: true,
                    sellerFinalSettlementClicked: true,
                    sellerFinalSettlementDate: serverTimestamp(),
                    sellerPaymentAmount: totalSellerPaymentAmount,
                    buyerReturnAmount: finalRefundAmount,
                    adminFeeAmount: totalAdminFee,
                });
                
                // 4. 구매자 잔액 업데이트 및 거래 기록
                if (finalRefundAmount > 0) {
                    const newBalance = buyerData.balance + finalRefundAmount;
                    transaction.update(buyerRef, { balance: newBalance });
                    
                    const newTransaction = {
                        uid: appData.uid,
                        applicationId: appDoc.id,
                        amount: finalRefundAmount,
                        type: "return",
                        description: `거래 완료 반환: ${appData.itemType} (${actualQuantity}개) - 수수료 ${totalAdminFee.toLocaleString()}원`,
                        timestamp: serverTimestamp(),
                    };
                    transaction.set(doc(transactionsRef), newTransaction);
                }
            });

            alert("거래가 승인되었습니다. 최종 정산이 완료되었습니다.");
            setApplication(prev => prev ? { ...prev, sellerFinalSettlementClicked: true, settled: true } : null);

        } catch (err) {
            console.error("최종 정산 트랜잭션 실행 중 오류 발생:", err);
            alert("최종 정산 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };


    const handleSellerReject = async () => {
        if (!application || !session?.user?.id || !isRelevantSeller) {
            alert("거래를 거절할 권한이 없습니다.");
            return;
        }

        setLoading(true);
        try {
            const appRef = doc(db, "applications", application.id);
            await updateDoc(appRef, {
                rejected: true,
                status: "rejected"
            });
            setApplication(prev => prev ? { ...prev, rejected: true, status: "rejected" } : null);
            alert("거래가 거절되었습니다. 고객센터로 문의해주세요.");
        } catch (err) {
            console.error("Error rejecting trade:", err);
            alert("거래 거절 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleSellerAllInfoSubmit = async () => {
        if (!application || !session?.user?.id || !isRelevantSeller) {
            alert("이 신청서에 정보를 제공할 권한이 없습니다.");
            return;
        }

        const isAnyNicknameMissing = sellerItemInputs.some(item => !item.nickname);
        if (isAnyNicknameMissing) {
            alert("모든 물품의 닉네임을 입력해주세요.");
            return;
        }

        if (!sellerAccountInfo.bankName.trim() || !sellerAccountInfo.accountNumber.trim() || !sellerAccountInfo.accountHolder.trim()) {
            alert("계좌 정보를 모두 입력해주세요 (은행명, 계좌번호, 예금주명).");
            return;
        }

        setLoading(true);
        try {
            const appRef = doc(db, "applications", application.id);
            const combinedSellerAccount = `${sellerAccountInfo.bankName.trim()} ${sellerAccountInfo.accountNumber.trim()} ${sellerAccountInfo.accountHolder.trim()}`;

            const updateData: any = {
                sellerInfoProvided: true,
                sellerItemInputs,
                sellerAccount: combinedSellerAccount,
            };

            await updateDoc(appRef, updateData);

            setApplication((prev) => prev ? {
                ...prev,
                sellerInfoProvided: true,
                sellerItemInputs,
                sellerAccount: combinedSellerAccount,
            } : null);
            alert("정보가 성공적으로 전송되었습니다. 구매자의 확인을 기다려주세요.");
        } catch (err) {
            console.error("Error saving all seller info:", err);
            alert("정보 저장에 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (index: number, field: keyof typeof sellerItemInputs[0], value: any) => {
        setSellerItemInputs(prev => {
            const newInputs = [...prev];
            newInputs[index] = { ...newInputs[index], [field]: value };
            return newInputs;
        });
    };

    const handleTimeButton = (index: number, type: 'now' | 'manual' | 'impossible') => {
        const now = new Date().toLocaleTimeString('ko-KR', { hour: 'numeric', minute: 'numeric', hour12: true });

        if (type === 'now') {
            handleInputChange(index, 'time', now);
            handleInputChange(index, 'status', 'received');
            handleInputChange(index, 'showManual', false);
        } else if (type === 'manual') {
            handleInputChange(index, 'showManual', true);
        } else if (type === 'impossible') {
            handleInputChange(index, 'time', "불가능");
            handleInputChange(index, 'status', 'not_possible');
            handleInputChange(index, 'showManual', false);
        }
    };

    const handleSelectSavedAccount = (savedInfo: SavedInfo) => {
        setSellerAccountInfo({
            bankName: savedInfo.name,
            accountNumber: savedInfo.value,
            accountHolder: savedInfo.accountHolder,
        });
    };

    const handleCopyBuyerInfo = (textToCopy: string) => {
        if (textToCopy) {
            try {
                navigator.clipboard.writeText(textToCopy);
                alert("정보가 복사되었습니다!");
            } catch (err) {
                console.error("정보 복사 실패:", err);
                alert("정보 복사에 실패했습니다. 수동으로 복사해주세요.");
            }
        }
    };

    if (loading || status === "loading") {
        return (
            <div className="flex justify-center items-center min-h-screen text-gray-700">
                로딩 중...
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen text-red-500">
                오류: {error}
            </div>
        );
    }

    if (!application || !currentUserRole || !isRelevantSeller) {
        return (
            <div className="flex justify-center items-center min-h-screen text-red-500">
                이 거래를 조회할 권한이 없거나, 올바른 판매자 역할이 아닙니다.
            </div>
        );
    }

    const renderTradeInfo = () => (
        <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border border-gray-200">
            <h2 className="text-xl font-bold mb-2 text-gray-800">
                {application.itemType} {getApplicationTitleStatus()}
            </h2>
            <p className="text-gray-700 mb-2">총 수량: {application.quantity}개</p>
            <p className="text-gray-700 mb-2">내 참여 수량: {application.sellerParticipations?.[session?.user?.id as string] || 0}개</p>
            <p className="text-gray-700 mb-4">
                가격: {application.unitPrice.toLocaleString()}원
                {application.itemType === "티켓(꽃)" && application.altUnitPrice && application.altUnitPrice !== application.unitPrice && (
                    <span className="ml-2 text-gray-500 text-sm">
                        (접속시 {application.altUnitPrice.toLocaleString()}원)
                    </span>
                )}
            </p>
            <p className="text-lg font-bold text-center text-green-600 mt-4 border-t pt-4">
                {getCurrentTradeStatusMessage()}
            </p>
        </div>
    );

    const renderSellerActions = () => (
        <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4">
            <h3 className="text-xl font-semibold mb-4 text-green-500">
                판매자님 진행
            </h3>

            {!hasBuyerProvidedInfo && (
                <p className="text-gray-600 text-center">
                    구매자가 물품 수령 링크를 입력하는 것을 기다리고 있습니다.
                </p>
            )}

            {hasBuyerProvidedInfo && !hasSellerAllInfoProvided && renderSellerInputs()}
            {hasSellerAllInfoProvided && !buyerSettlementClicked && (
                <p className="text-gray-600 text-center">
                    구매자의 입금 확인을 기다리고 있습니다.
                </p>
            )}
            {buyerSettlementClicked && !application.sellerFinalSettlementClicked && renderSettlementButtons()}
            {application.sellerFinalSettlementClicked && (
                <p className="text-gray-600 text-center">
                    판매자가 최종 정산을 완료했습니다.
                </p>
            )}
        </div>
    );

    const renderSellerInputs = () => (
        <>
            <div className="mb-4 p-4 bg-gray-100 rounded-lg border border-gray-300">
                <p className="block text-gray-700 text-sm font-bold mb-2">
                    구매자 입력 정보
                </p>
                <div className="flex items-center gap-2">
                    <a
                        href={application?.tradeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-lg text-blue-600 flex-grow break-all underline hover:text-blue-800"
                    >
                        {application?.tradeLink}
                    </a>
                    <button
                        type="button"
                        onClick={() => handleCopyBuyerInfo(application?.tradeLink || '')}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded focus:outline-none focus:shadow-outline text-sm"
                        title="구매자 정보 복사"
                    >
                        복사
                    </button>
                </div>
            </div>

            <div className="mb-4">
                <p className="block text-gray-700 text-sm font-bold mb-2">
                    정보를 입력해주세요.
                </p>

                {sellerItemInputs.map((item, index) => (
                    <div key={index} className="border border-gray-200 p-4 rounded-lg mb-4 bg-gray-50">
                        <div className="mb-2">
                            <label htmlFor={`nickname-${index}`} className="block text-gray-700 text-sm font-bold mb-1">
                                닉네임 {index + 1}
                            </label>
                            <input
                                id={`nickname-${index}`}
                                type="text"
                                value={item.nickname}
                                onChange={(e) => handleInputChange(index, 'nickname', e.target.value)}
                                placeholder="닉네임을 입력해주세요"
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                            />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <p className="font-semibold text-gray-700 whitespace-nowrap">시간:</p>
                            <button
                                onClick={() => handleTimeButton(index, 'now')}
                                className="bg-green-500 hover:bg-green-600 text-white text-xs font-bold py-2 px-3 rounded w-full"
                            >
                                방금
                            </button>
                            <button
                                onClick={() => handleTimeButton(index, 'manual')}
                                className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold py-2 px-3 rounded w-full"
                            >
                                직접입력
                            </button>
                            <button
                                onClick={() => handleTimeButton(index, 'impossible')}
                                className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold py-2 px-3 rounded w-full"
                            >
                                불가능
                            </button>
                        </div>
                        {item.showManual && (
                            <div className="mb-2">
                                <input
                                    type="text"
                                    placeholder="예: 오후 10:30"
                                    value={item.time}
                                    onChange={(e) => handleInputChange(index, 'time', e.target.value)}
                                    className="shadow-sm border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                />
                            </div>
                        )}
                        {item.time && (
                            <p className="text-sm text-gray-600 mt-2 text-right">
                                현재 기록된 시간: <span className="font-bold">{item.time}</span>
                            </p>
                        )}
                    </div>
                ))}

                <div className="mt-4">
                    <p className="block text-gray-700 text-sm font-bold mb-2">
                        내 정산 계좌 정보
                    </p>
                    {savedAccounts.length > 0 && (
                        <div className="mb-2">
                            <p className="block text-gray-700 text-xs font-bold mb-1">
                                내 저장된 계좌 정보 선택
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {savedAccounts.map((info) => (
                                    <button
                                        key={info.id}
                                        onClick={() => handleSelectSavedAccount(info)}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm py-2 px-3 rounded-lg border border-gray-300 transition-colors duration-200 text-left"
                                    >
                                        <span className="font-semibold">{info.name}:</span> {info.value} ({info.accountHolder})
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                    <input
                        id="sellerBankNameInput"
                        type="text"
                        value={sellerAccountInfo.bankName}
                        onChange={(e) => setSellerAccountInfo({ ...sellerAccountInfo, bankName: e.target.value })}
                        placeholder="은행명"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2"
                    />
                    <input
                        id="sellerAccountNumberInput"
                        type="text"
                        value={sellerAccountInfo.accountNumber}
                        onChange={(e) => setSellerAccountInfo({ ...sellerAccountInfo, accountNumber: e.target.value })}
                        placeholder="계좌번호"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-2"
                    />
                    <input
                        id="sellerAccountHolderInput"
                        type="text"
                        value={sellerAccountInfo.accountHolder}
                        onChange={(e) => setSellerAccountInfo({ ...sellerAccountInfo, accountHolder: e.target.value })}
                        placeholder="예금주명"
                        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                    />
                </div>
            </div>
            <button
                onClick={handleSellerAllInfoSubmit}
                className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
            >
                정보 전송
            </button>
        </>
    );

    const renderSettlementButtons = () => (
        <>
            <div className="mb-4">
                <p className="text-lg font-bold text-gray-700 mb-2">
                    구매자 확인 결과
                </p>
                {application?.sellerItemInputs?.map((item, index) => (
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
                            <span className="font-bold">
                                {application?.buyerItemConfirmations?.[index] === 'confirmed' ? (
                                    <span className="text-green-500">확인 완료</span>
                                ) : application?.buyerItemConfirmations?.[index] === 'unconfirmed' ? (
                                    <span className="text-red-500">확인 불가</span>
                                ) : (
                                    <span className="text-gray-400">미확인</span>
                                )}
                            </span>
                        </div>
                        {application?.buyerItemConfirmations?.[index] === 'unconfirmed' && (
                            <p className="text-xs text-red-400 mt-1">
                                사유: {application?.buyerItemRejectionReasons?.[index]}
                            </p>
                        )}
                    </div>
                ))}
            </div>

            <p className="text-sm text-gray-600 mb-2 text-center">
                입금 확인이 되면 버튼을 눌러주세요.<br />
                입금이 안 되었거나 이의 제기가 있으시면 거절을 누르고 고객센터로 문의 주세요.
            </p>

            <p className="text-sm text-red-500 font-bold mb-4 text-center">
                너무 늦는 정산과 입금 받지 못하고 승인 누르신 경우 <br />
                돌려받기 어렵습니다. 정확하게 체크해주세요.
            </p>

            <div className="flex gap-4 mt-4">
                <button
                    onClick={handleSellerApprove}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    승인
                </button>
                <button
                    onClick={handleSellerReject}
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                    거절
                </button>
            </div>
        </>
    );

    return (
        <>
            <TabBar />
            <div className="max-w-md mx-auto p-4 pt-8 pb-20 font-sans">
                <h1 className="text-2xl font-bold text-center text-green-600 mb-6">
                    판매자 거래 상세 📄
                </h1>
                {renderTradeInfo()}
                {!application.rejected && !application.settled && isRelevantSeller && renderSellerActions()}
                {!isRelevantSeller && (
                    <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4 text-center">
                        <p className="text-red-500">이 신청서에 대한 상호작용 권한이 없습니다.</p>
                    </div>
                )}
            </div>
        </>
    );
}