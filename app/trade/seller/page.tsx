"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { db, functions } from "@/lib/firebase";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    arrayUnion,
    Timestamp,
    query,
    where,
    and,
    or,
    getDoc,
    increment,
    limit,
    startAfter,
    runTransaction,
    serverTimestamp
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import { httpsCallable } from "firebase/functions";

interface Application {
    id: string;
    role: "buyer" | "seller";
    participants?: string[];
    itemType?: "저금통" | "티켓(꽃)" | "낚시도움";
    status?: "대기중" | "거래중" | "미접" | "접속" | string;
    quantity?: number;
    remainingQuantity?: number;
    unitPrice?: number;
    altUnitPrice?: number;
    uid?: string;
    todayOrTomorrow?: "today" | "tomorrow";
    approved?: boolean;
    rejected?: boolean;
    closed?: boolean;
    settled?: boolean;
    createdAt?: Timestamp;
    sellerEntries?: any[];
    needsAdmin?: boolean;
    sellerParticipations?: { [uid: string]: number };
    failedSellerAttempts?: Array<{
        sellerId: string;
        timestamp: Timestamp;
        reason: string;
    }>;
    accountNickname?: string;
}

const deleteApplicationCallable = httpsCallable(
    functions,
    "deleteApplicationOnInsufficientDeposit"
);

export default function SellerTradePage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<
        "전체" | "진행중" | "내일 거래"
    >("전체");
    const [applications, setApplications] = useState<Application[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const [filterItem, setFilterItem] = useState<string>("저금통");
    const [filterStatus, setFilterStatus] = useState<string>("");
    const [sortOption, setSortOption] = useState<string>("기본");

    useEffect(() => {
        if (status === "authenticated" && session?.user?.id) {
            setUserId(session.user.id);
        } else if (status === "unauthenticated") {
            setUserId(null);
            setApplications([]);
            setLoading(false);
        }
    }, [status, session?.user?.id]);

    const fetchApplications = useCallback(async () => {
        if (!userId) {
            if (status === "loading") {
                setLoading(true);
            } else {
                setLoading(false);
                setApplications([]);
                return;
            }
        }

        setLoading(true);
        setApplications([]);
        setLastDoc(null);
        setHasMore(true);

        const baseCollectionRef = collection(db, "applications");
        let fetchedApps: Application[] = [];
        const uid = userId;

        if (!uid) {
            setLoading(false);
            return;
        }

        try {
            if (activeTab === "전체") {
                let q = query(
                    baseCollectionRef,
                    where("role", "==", "buyer"),
                    where("rejected", "==", false),
                    where("settled", "==", false),
                    where("closed", "==", false),
                    where("itemType", "==", filterItem),
                    limit(10)
                );

                if (filterItem === "티켓(꽃)" && filterStatus !== "") {
                    q = query(q, where("status", "==", filterStatus));
                }

                const snap = await getDocs(q);
                fetchedApps = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() } as Application))
                    .filter((app) => {
                        const isToday =
                            app.todayOrTomorrow === "today" ||
                            app.todayOrTomorrow === undefined;
                        const hasParticipated = app.participants?.includes(uid);
                        return isToday && !hasParticipated;
                    });

                setLastDoc(snap.docs[snap.docs.length - 1] || null);
                setHasMore(snap.docs.length === 10);
            } else if (activeTab === "내일 거래") {
                let q = query(
                    baseCollectionRef,
                    where("role", "==", "buyer"),
                    where("closed", "==", false),
                    where("todayOrTomorrow", "==", "tomorrow"),
                    where("rejected", "==", false),
                    where("itemType", "==", filterItem)
                );

                if (filterItem === "티켓(꽃)" && filterStatus !== "") {
                    q = query(q, where("status", "==", filterStatus));
                }

                const snap = await getDocs(q);
                fetchedApps = snap.docs
                    .map((d) => ({ id: d.id, ...d.data() } as Application))
                    .filter((app) => {
                        const remaining = app.remainingQuantity ?? app.quantity ?? 0;
                        const hasParticipated = app.participants?.includes(uid);
                        return remaining > 0 && !hasParticipated;
                    });
            } else if (activeTab === "진행중") {
                const q = query(
                    baseCollectionRef,
                    and(
                        where("approved", "==", true),
                        where("settled", "==", false),
                        where("rejected", "==", false),
                        or(
                            and(where("uid", "==", uid), where("role", "==", "seller")),
                            and(
                                where("participants", "array-contains", uid),
                                where("role", "==", "buyer")
                            )
                        )
                    )
                );
                const snap = await getDocs(q);
                fetchedApps = snap.docs.map(
                    (d) => ({ id: d.id, ...d.data() } as Application)
                );
            }

            if (activeTab === "전체" || activeTab === "내일 거래") {
                if (sortOption === "최신순") {
                    fetchedApps.sort(
                        (a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
                    );
                } else if (sortOption === "금액 높은순") {
                    fetchedApps.sort((a, b) => (b.unitPrice || 0) - (a.unitPrice || 0));
                } else if (sortOption === "금액 낮은순") {
                    fetchedApps.sort((a, b) => (a.unitPrice || 0) - (b.unitPrice || 0));
                }
            }

            setApplications(fetchedApps);
        } catch (error) {
            console.error("Error fetching applications:", error);
        } finally {
            setLoading(false);
        }
    }, [userId, activeTab, filterItem, filterStatus, sortOption, status]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const loadMoreApplications = async () => {
        if (!lastDoc) return;
        setLoading(true);
        const baseCollectionRef = collection(db, "applications");

        let q = query(
            baseCollectionRef,
            where("role", "==", "buyer"),
            where("rejected", "==", false),
            where("settled", "==", false),
            where("closed", "==", false),
            where("itemType", "==", filterItem),
            startAfter(lastDoc),
            limit(10)
        );

        if (filterItem === "티켓(꽃)" && filterStatus !== "") {
            q = query(q, where("status", "==", filterStatus));
        }

        try {
            const snap = await getDocs(q);
            const newApps = snap.docs
                .map((d) => ({ id: d.id, ...d.data() } as Application))
                .filter((app) => {
                    const isToday =
                        app.todayOrTomorrow === "today" ||
                        app.todayOrTomorrow === undefined;
                    const hasParticipated = app.participants?.includes(userId ?? "");
                    return isToday && !hasParticipated;
                });

            setApplications((prevApps) => [...prevApps, ...newApps]);
            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(newApps.length === 10);
        } catch (error) {
            console.error("Error loading more applications:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleParticipate = async (id: string, app: Application) => {
        if (status === "loading" || !userId) {
            alert("로그인이 필요합니다. 로그인 후 다시 시도해주세요.");
            return;
        }

        const appRef = doc(db, "applications", id);
        
        try {
            await runTransaction(db, async (transaction) => {
                const appDoc = await transaction.get(appRef);
                if (!appDoc.exists()) {
                    throw new Error("신청서를 찾을 수 없습니다.");
                }
                const currentApp = appDoc.data() as Application;

                const hasParticipated = currentApp.participants?.includes(userId);
                if (hasParticipated) {
                    throw new Error("이미 참여한 거래입니다.");
                }

                const currentRemaining = currentApp.remainingQuantity ?? currentApp.quantity ?? 0;
                if (currentRemaining <= 0 || currentApp.closed || currentApp.rejected || currentApp.settled) {
                    throw new Error("이미 마감되었거나 남은 수량이 없습니다.");
                }

                let count: number;

                if (currentApp.itemType === "저금통") {
                    count = 1;
                    if (count > currentRemaining) {
                        throw new Error("남은 수량이 1개 미만입니다. 참여할 수 없습니다.");
                    }
                } else {
                    const input = prompt(
                        `참여할 수량을 입력해주세요 (최대 ${currentRemaining}개)`
                    );
                    if (!input) {
                        throw new Error("사용자 취소");
                    }
                    count = parseInt(input);

                    if (isNaN(count) || count <= 0 || count > currentRemaining) {
                        throw new Error("유효한 수량을 입력해주세요.");
                    }
                }

                const buyerUid = currentApp.uid;
                if (!buyerUid) {
                    throw new Error("구매자 정보를 찾을 수 없습니다. (구매자 UID 누락)");
                }

                const buyerRef = doc(db, "users", buyerUid);
                const buyerDoc = await transaction.get(buyerRef);
                if (!buyerDoc.exists()) {
                    throw new Error("구매자 사용자 정보를 찾을 수 없습니다.");
                }

                const buyerData = buyerDoc.data();
                const buyerBalance = typeof buyerData?.balance === "number" ? buyerData.balance : 0;

                const unitPrice = currentApp.unitPrice ?? 0;
                const requiredAmount = count * unitPrice;

                if (buyerBalance < requiredAmount) {
                    await deleteApplicationCallable({
                        applicationId: id,
                        sellerId: userId,
                        reason: "insufficient_buyer_balance",
                    });
                    alert("구매자 잔액이 부족하여 신청서가 삭제되었습니다.");
                    setApplications((prevApps) => prevApps.filter((app) => app.id !== id));
                    return;
                }

                const newRemainingQuantity = (currentApp.remainingQuantity ?? currentApp.quantity ?? 0) - count;

                const updatePayload: Record<string, any> = {
                    remainingQuantity: newRemainingQuantity,
                    participants: arrayUnion(userId),
                    approved: true,
                    status: "거래중",
                    [`sellerParticipations.${userId}`]: count,
                };

                if (newRemainingQuantity <= 0) {
                    updatePayload.closed = true;
                }

                transaction.update(appRef, updatePayload);
                transaction.update(buyerRef, { balance: increment(-requiredAmount) });
                
                // Add this part to record the transaction
                const transactionDocRef = doc(collection(db, "transactions"));
                transaction.set(transactionDocRef, {
                    uid: buyerUid,
                    type: "deduction",
                    amount: requiredAmount,
                    timestamp: serverTimestamp(),
                    description: `판매자 거래 참여: ${app.itemType} ${count}개`,
                });

                alert(
                    `✅ ${count}개 참여하였습니다. 구매자 잔액 ${requiredAmount}원이 차감되었습니다.`
                );
                setActiveTab("진행중");
            });
        } catch (error: any) {
            if (error.message !== "사용자 취소") {
                console.error("판매자 참여 중 오류 발생:", error);
                alert("판매자 참여 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
            }
        }
    };

    const formatAppLine = (app: Application) => {
        const unit = app.unitPrice ?? 0;
        const alt = app.altUnitPrice ?? 0;
        const originalQuantity = app.quantity ?? 0;
        const remaining = app.remainingQuantity ?? app.quantity ?? 0;
        const participated = app.sellerParticipations?.[userId ?? ""] || 0;

        let displayPrefix = "";
        let mainContent = "";

        if (activeTab === "진행중") {
            if (app.role === "seller" && app.uid === userId) {
                if (app.itemType === "낚시도움") {
                    mainContent = `${app.accountNickname ? `[${app.accountNickname}] ` : ''}낚시도움 ${originalQuantity}개 ${unit.toLocaleString()}원`;
                } else if (app.itemType === "저금통") {
                    mainContent = `저금통 ${originalQuantity}개 (총 ${ (unit * originalQuantity).toLocaleString()}원)`;
                } else if (app.itemType === "티켓(꽃)") {
                    const statusText = app.status === "seller_waiting_for_info" ? "미접" : (app.status || "알 수 없음");
                    mainContent = `티켓(꽃) ${statusText} ${originalQuantity}개 개당 ${unit.toLocaleString()}원${
                        alt ? ` (접속시 ${alt.toLocaleString()}원)` : ""
                    }`;
                }
            } else if (app.role === "buyer" && app.participants?.includes(userId ?? "")) {
                const participatedQuantity = app.sellerParticipations?.[userId ?? ""] || 0;
                displayPrefix = `[${participatedQuantity}개 참여] `;

                if (app.itemType === "낚시도움") {
                    mainContent = `${app.accountNickname ? `[${app.accountNickname}] ` : ''}낚시도움 ${originalQuantity}개 ${unit.toLocaleString()}원`;
                } else if (app.itemType === "저금통") {
                    mainContent = `저금통 개당 ${unit.toLocaleString()}원`;
                } else if (app.itemType === "티켓(꽃)") {
                    const statusText = app.status === "seller_waiting_for_info" ? "미접" : (app.status || "알 수 없음");
                    mainContent = `티켓(꽃) ${statusText} 개당 ${unit.toLocaleString()}원${
                        alt ? ` (접속시 ${alt.toLocaleString()}원)` : ""
                    }`;
                }
            }
        } else {
            const remainingText = remaining > 0 ? `${remaining}개 남음` : "마감됨";
            
            if (remaining < 0) {
                const overParticipated = Math.abs(remaining);
                const overParticipatedPrice = overParticipated * unit;
                mainContent = `❌ ${overParticipated}개 초과, ${overParticipatedPrice.toLocaleString()}원 추가금 발생`;
            } else if (app.itemType === "저금통") {
                const totalPrice = (remaining) * unit;
                mainContent = `저금통 ${remainingText ? remainingText + " " : ""}${totalPrice.toLocaleString()}원`;
            } else if (app.itemType === "티켓(꽃)") {
                const statusText = app.status === "seller_waiting_for_info" ? "미접" : (app.status || "알 수 없음");
                mainContent = `티켓(꽃) ${remainingText ? remainingText + " " : ""}${statusText} ${unit.toLocaleString()}원${
                    alt ? ` (접속시 ${alt.toLocaleString()}원)` : ""
                }`;
            } else if (app.itemType === "낚시도움") {
                mainContent = `${
                    app.accountNickname ? `[${app.accountNickname}] ` : ""
                }낚시도움 ${originalQuantity}개 ${unit.toLocaleString()}원`;
            }

            if (app.status === "거래중") {
                displayPrefix = "[거래중] ";
            }
        }

        const failedAttempts = app.failedSellerAttempts;
        if (failedAttempts && failedAttempts.length > 0) {
            const lastAttempt = failedAttempts[failedAttempts.length - 1];
            const attemptDate = lastAttempt.timestamp.toDate().toLocaleDateString();
            const attemptTime = lastAttempt.timestamp
                .toDate()
                .toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            mainContent += ` (❗ ${attemptDate} ${attemptTime} 판매자 참여 실패 - 잔액 부족)`;
        }

        return displayPrefix + mainContent;
    };

    return (
        <main className="max-w-md mx-auto p-4">
            <TabBar />
            <h2 className="text-xl font-bold text-center mb-3">거래 페이지 (판매자)</h2>

            <div className="flex justify-center gap-4 mb-3">
                {["전체", "진행중", "내일 거래"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab as typeof activeTab)}
                        className={`px-4 py-1 rounded-full text-sm font-semibold border ${
                            activeTab === tab
                                ? "bg-pink-500 text-white"
                                : "bg-gray-100 text-gray-600"
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {(activeTab === "전체" || activeTab === "내일 거래") && (
                <div className="flex gap-2 mb-3 text-sm">
                    <select
                        value={filterItem}
                        onChange={(e) => {
                            setFilterItem(e.target.value);
                            if (e.target.value === "티켓(꽃)") {
                                setFilterStatus("미접");
                            } else {
                                setFilterStatus("");
                            }
                        }}
                        className="border px-2 py-1 rounded flex-1"
                    >
                        <option value="저금통">저금통</option>
                        <option value="티켓(꽃)">티켓(꽃)</option>
                        <option value="낚시도움">낚시도움</option>
                    </select>

                    {filterItem === "티켓(꽃)" && (
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="border px-2 py-1 rounded flex-1"
                        >
                            <option value="미접">미접</option>
                            <option value="접속">접속</option>
                        </select>
                    )}

                    <select
                        value={sortOption}
                        onChange={(e) => setSortOption(e.target.value)}
                        className="border px-2 py-1 rounded flex-1"
                    >
                        <option value="기본">정렬없음</option>
                        <option value="최신순">최신순</option>
                        <option value="금액 높은순">금액 높은순</option>
                        <option value="금액 낮은순">금액 낮은순</option>
                    </select>
                </div>
            )}

            {loading && applications.length === 0 ? (
                <p className="text-center text-gray-400">
                    {status === "loading"
                        ? "로그인 정보를 불러오는 중..."
                        : "데이터를 불러오는 중..."}
                </p>
            ) : applications.length === 0 ? (
                <p className="text-center text-gray-500">표시할 신청서가 없습니다.</p>
            ) : (
                <div className="space-y-2">
                    {applications.map((app) => {
                        const hasParticipated = app.participants?.includes(userId ?? "");
                        const isRejectedByBuyer = app.rejected === true;
                        const isClosed = app.closed === true;
                        const isSettled = app.settled === true;

                        const needsAttention =
                            activeTab === "진행중" &&
                            app.role === "buyer" &&
                            hasParticipated &&
                            (app.sellerParticipations?.[userId ?? ""] || 0) >
                            (app.sellerEntries?.length || 0);

                        const canParticipate =
                            userId !== null &&
                            status === "authenticated" &&
                            (activeTab === "전체" || activeTab === "내일 거래") &&
                            app.role === "buyer" &&
                            !isSettled &&
                            !isClosed &&
                            !isRejectedByBuyer &&
                            !hasParticipated && 
                            (app.remainingQuantity ?? app.quantity ?? 0) > 0;
                        
                        return (
                            <div
                                key={app.id}
                                onClick={() => {
                                    if (activeTab === "진행중") {
                                        if (app.role === "buyer" && hasParticipated) {
                                            router.push(`/trade/seller/${app.id}`);
                                        } else if (app.role === "seller" && app.uid === userId) {
                                            router.push(`/trade/seller/${app.id}`);
                                        }
                                    } else {
                                        router.push(`/trade/seller/${app.id}`);
                                    }
                                }}
                                className={`border p-3 rounded bg-white shadow-sm ${
                                    isRejectedByBuyer
                                        ? "border-red-500"
                                        : needsAttention
                                            ? "border-yellow-500"
                                            : "border-gray-300"
                                } ${
                                    activeTab === "진행중" || (hasParticipated && app.approved && !isSettled)
                                        ? "cursor-pointer"
                                        : ""
                                }`}
                            >
                                <p className="flex justify-between items-center">
                                    <span>{formatAppLine(app)}</span>
                                    {isRejectedByBuyer && (
                                        <span className="text-red-500 text-xs font-bold ml-2">
                                            ❌ 구매자에 의해 거절됨
                                        </span>
                                    )}
                                    {isSettled && (
                                        <span className="text-green-600 text-xs font-bold ml-1">
                                            ✅ 정산완료
                                        </span>
                                    )}
                                </p>

                                {canParticipate && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleParticipate(app.id, app);
                                        }}
                                        disabled={!canParticipate || !userId || status !== "authenticated"}
                                        className="mt-2 px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        판매하기
                                    </button>
                                )}

                                {activeTab !== "진행중" && hasParticipated && !app.rejected && !app.closed && (
                                    <p className="text-blue-600 text-sm mt-1">
                                        참여하였습니다. 승인 대기 중...
                                    </p>
                                )}
                            </div>
                        );
                    })}
                    
                    {activeTab === "전체" && hasMore && (
                        <div className="flex justify-center mt-4">
                            <button
                                onClick={loadMoreApplications}
                                disabled={loading}
                                className="px-4 py-2 text-sm font-semibold rounded-full bg-pink-100 text-pink-600 hover:bg-pink-200 transition"
                            >
                                {loading ? "불러오는 중..." : "더보기"}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}