"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { db } from "@/lib/firebase";
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
    runTransaction,
    serverTimestamp,
    limit,
    startAfter,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";
import Link from "next/link";

interface Application {
    id: string;
    role: "buyer" | "seller";
    participants?: string[];
    itemType?: string;
    status?: string;
    fishName?: string;
    quantity?: number;
    unitPrice?: number;
    altUnitPrice?: number;
    uid?: string;
    todayOrTomorrow?: "today" | "tomorrow";
    approved?: boolean;
    rejected?: boolean;
    closed?: boolean;
    settled?: boolean;
    createdAt?: Timestamp | null;
    sellerEntries?: Array<{
        quantity: number;
        sellerId: string;
    }>;
    needsAdmin?: boolean;
    forceHidden?: boolean;
    accountNickname?: string;
    buyerLinkSent?: boolean;
    failedSellerAttempts?: Array<{
        sellerId: string;
        timestamp: Timestamp;
        reason: string;
    }>;
    sellerParticipations?: { [key: string]: number };
    isSplit?: boolean;
    sellerId?: string;
    originalId?: string;
}

interface UserProfile {
    balance: number;
}

export default function BuyerTradePage() {
    const { data: session, status: sessionStatus } = useSession();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<"전체" | "진행중" | "내일 거래">("전체");
    const [applications, setApplications] = useState<Application[]>([]);
    const [userId, setUserId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);

    const [filterItem, setFilterItem] = useState<string>("저금통");
    const [filterStatus, setFilterStatus] = useState<string>("전체");
    const [sortOption, setSortOption] = useState<string>("기본");

    const normalizeItemType = (type?: string): string => {
        if (type === "티켓(꽃)") return "티켓(꽃)";
        if (type === "저금통") return "저금통";
        if (type === "낚시도움") return "낚시도움";
        return type ?? "";
    };

    useEffect(() => {
        if (sessionStatus === "authenticated" && session?.user?.id) {
            setUserId(session.user.id);
        } else if (sessionStatus === "unauthenticated") {
            setUserId(null);
            setApplications([]);
            setLoading(false);
        }
    }, [sessionStatus, session?.user?.id]);

    useEffect(() => {
        if (!userId) {
            if (sessionStatus === "loading") {
                setLoading(true);
            } else {
                setLoading(false);
                setApplications([]);
            }
            return;
        }

        setApplications([]);
        setLastDoc(null);
        setHasMore(true);
        fetchApplications();
    }, [userId, activeTab, filterItem, filterStatus, sortOption, sessionStatus]);

    const fetchApplications = async () => {
        setLoading(true);
        setError(null);
        const baseCollectionRef = collection(db, "applications");
        const now = Timestamp.now();

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
                    where("role", "==", "seller"),
                    where("approved", "==", false),
                    where("closed", "==", false),
                    where("rejected", "==", false),
                    where("createdAt", "<=", now),
                    where("itemType", "==", filterItem),
                    limit(10)
                );

                if (filterItem === "티켓(꽃)" && filterStatus !== "전체") {
                    q = query(q, where("status", "==", filterStatus));
                }

                const snap = await getDocs(q);
                fetchedApps = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Application[];
                
                setLastDoc(snap.docs[snap.docs.length - 1] || null);
                setHasMore(snap.docs.length === 10);
            } else if (activeTab === "내일 거래") {
                let q = query(
                    baseCollectionRef,
                    where("role", "==", "seller"),
                    where("approved", "==", false),
                    where("closed", "==", false),
                    where("rejected", "==", false),
                    where("createdAt", ">", now),
                    where("itemType", "==", filterItem)
                );

                if (filterItem === "티켓(꽃)" && filterStatus !== "전체") {
                    q = query(q, where("status", "==", filterStatus));
                }

                const snap = await getDocs(q);
                fetchedApps = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Application[];

            } else if (activeTab === "진행중") {
                const participantQuery = query(
                    baseCollectionRef,
                    where("participants", "array-contains", uid),
                    where("settled", "==", false),
                    where("rejected", "==", false)
                );
            
                const creatorQuery = query(
                    baseCollectionRef,
                    where("uid", "==", uid),
                    where("settled", "==", false),
                    where("rejected", "==", false)
                );
            
                const [participantSnap, creatorSnap] = await Promise.all([
                    getDocs(participantQuery),
                    getDocs(creatorQuery),
                ]);
            
                const combinedApps = new Map();
                participantSnap.docs.forEach((doc) => {
                    combinedApps.set(doc.id, { id: doc.id, ...doc.data() });
                });
                creatorSnap.docs.forEach((doc) => {
                    combinedApps.set(doc.id, { id: doc.id, ...doc.data() });
                });
            
                fetchedApps = Array.from(combinedApps.values()) as Application[];
            }

            fetchedApps.sort((a, b) => {
                const aQty = normalizeItemType(a.itemType) === "낚시도움" ? (a.quantity ?? 0) : (a.quantity ?? 0);
                const bQty = normalizeItemType(b.itemType) === "낚시도움" ? (b.quantity ?? 0) : (b.quantity ?? 0);
                const aPrice =
                    normalizeItemType(a.itemType) === "티켓(꽃)" && a.status === "접속"
                        ? a.altUnitPrice ?? 0
                        : a.unitPrice ?? 0;
                const bPrice =
                    normalizeItemType(b.itemType) === "티켓(꽃)" && b.status === "접속"
                        ? b.altUnitPrice ?? 0
                        : b.unitPrice ?? 0;

                if (sortOption === "가격높은순") return (bQty * bPrice) - (aQty * aPrice);
                if (sortOption === "가격낮은순") return (aQty * aPrice) - (bQty * bPrice);
                if (sortOption === "수량많은순") return bQty - aQty;
                if (sortOption === "수량적은순") return aQty - bQty;
                return 0;
            });

        } catch (err: any) {
            console.error("Error fetching applications:", err);
            setError("신청서를 불러오는 데 실패했습니다.");
        } finally {
            setApplications(fetchedApps);
            setLoading(false);
        }
    };

    const loadMoreApplications = async () => {
        setLoading(true);
        setError(null);
        const baseCollectionRef = collection(db, "applications");
        const now = Timestamp.now();

        let q = query(
            baseCollectionRef,
            where("role", "==", "seller"),
            where("approved", "==", false),
            where("closed", "==", false),
            where("rejected", "==", false),
            where("createdAt", "<=", now),
            where("itemType", "==", filterItem),
            startAfter(lastDoc),
            limit(10)
        );

        if (filterItem === "티켓(꽃)" && filterStatus !== "전체") {
            q = query(q, where("status", "==", filterStatus));
        }

        try {
            const snap = await getDocs(q);
            const newApps = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Application[];
            
            setApplications(prevApps => [...prevApps, ...newApps]);
            setLastDoc(snap.docs[snap.docs.length - 1] || null);
            setHasMore(newApps.length === 10);
        } catch (err) {
            console.error("Error loading more applications:", err);
            setError("더 많은 신청서를 불러오는 데 실패했습니다.");
        } finally {
            setLoading(false);
        }
    };


    const handleParticipate = async (appId: string, app: Application) => {
        if (!userId) {
            alert("로그인이 필요합니다.");
            return;
        }

        if (app.approved || (app.participants && app.participants.length > 0) || app.closed || app.rejected) {
            alert("이미 다른 참여자가 있거나, 승인되었거나, 마감되었거나, 거절된 신청서입니다.");
            return;
        }

        if (app.role !== "seller") {
            alert("이 신청서는 구매할 수 있는 판매자 신청서가 아닙니다.");
            return;
        }

        let totalAmount = 0;
        const quantityToUse = app.quantity ?? 0;
        const unitPrice = app.unitPrice ?? 0;

        // 티켓(꽃)의 경우, status에 따라 단가가 달라질 수 있으므로 unitPrice를 다시 계산
        let finalUnitPrice = unitPrice;
        if (app.itemType === "티켓(꽃)" && app.status === "접속") {
            finalUnitPrice = app.altUnitPrice ?? unitPrice;
        }

        totalAmount = quantityToUse * finalUnitPrice;

        if (totalAmount <= 0) {
            alert("유효한 금액이 아닙니다.");
            return;
        }

        const appRef = doc(db, "applications", appId);
        const userRef = doc(db, "users", userId);

        try {
            await runTransaction(db, async (transaction) => {
                const appDoc = await transaction.get(appRef);
                const userDoc = await transaction.get(userRef);

                if (!appDoc.exists()) {
                    throw "Application does not exist!";
                }
                if (!userDoc.exists()) {
                    throw "User profile does not exist!";
                }

                const currentApp = appDoc.data() as Application;
                const currentUser = userDoc.data() as UserProfile;

                if (currentApp.approved || (currentApp.participants && currentApp.participants.length > 0) || currentApp.closed || currentApp.rejected) {
                    throw "이미 다른 참여자가 있거나, 승인되었거나, 마감되었거나, 거절된 신청서입니다.";
                }
                if (currentApp.role !== "seller") {
                    throw "이 신청서는 구매할 수 있는 판매자 신청서가 아닙니다.";
                }

                if (currentUser.balance < totalAmount) {
                    transaction.update(appRef, {
                        forceHidden: true,
                        failedSellerAttempts: arrayUnion({
                            sellerId: userId,
                            timestamp: Timestamp.now(),
                            reason: "insufficient_buyer_balance",
                        }),
                    });
                    throw "보증금이 부족합니다. 충전 후 다시 시도해주세요.";
                }

                const newBalance = currentUser.balance - totalAmount;

                transaction.update(userRef, { balance: newBalance });

                // ⭐ 이 부분이 가장 중요한 수정 포인트입니다.
                // approved, participants 등은 업데이트하되, itemType은 건드리지 않습니다.
                const updateData: { [key: string]: any } = {
                    participants: arrayUnion(userId),
                    approved: true,
                    closed: false,
                    settled: false,
                    forceHidden: false,
                };
                // 티켓(꽃)의 경우, status를 'inprogress'로 변경
                if (currentApp.itemType === "티켓(꽃)") {
                    updateData.status = "inprogress";
                }

                transaction.update(appRef, updateData);

                transaction.set(doc(collection(db, "transactions")), {
                    uid: userId,
                    type: "deduction",
                    amount: totalAmount,
                    timestamp: serverTimestamp(),
                    description: `${app.itemType} 거래 참여: ${quantityToUse}개`,
                });
            });

            alert("참여가 완료되었습니다. 보증금이 차감되었습니다.");
            setActiveTab("진행중");
        } catch (error: any) {
            console.error("Error participating or transaction failed:", error);
            alert(`참여 중 오류가 발생했습니다: ${error.message || error}`);
            setActiveTab(activeTab);
        }
    };

    const navigateToDetailPage = (app: Application) => {
        const idToNavigate = app.isSplit ? app.originalId : app.id;
        if (idToNavigate) {
            router.push(`/trade/buyer/${idToNavigate}`);
        } else {
            console.error("No valid ID to navigate.");
        }
    };

    const formatAppLine = (app: Application) => {
        const itemType = normalizeItemType(app.itemType);
        const quantity = app.quantity ?? 0;
        const unit = app.unitPrice ?? 0;
        const alt = app.altUnitPrice ?? 0;
        
        let statusTag = "";
        
        let isFuture = false;
        if (app.createdAt instanceof Timestamp) {
            const createdAtDate = app.createdAt.toDate();
            isFuture = createdAtDate > new Date();
        }
        const tomorrowTag = isFuture ? "[내일] " : "";
        
        let mainContent = "";

        if (app.uid === userId) {
            mainContent = `[내가 작성] `;
        }
        else if (app.participants?.includes(userId ?? "")) {
            mainContent = `[내가 참여] `;
        }
        else if (app.isSplit && app.sellerId === userId) {
            mainContent = `[내가 참여] `;
        }

        if (itemType === "낚시도움") {
            mainContent += `${app.accountNickname ? `[${app.accountNickname}] ` : ''}낚시도움 ${quantity}개 ${unit.toLocaleString()}원`;
        } else if (itemType === "저금통") {
            mainContent += `저금통 ${quantity}개 ${(unit * quantity).toLocaleString()}원`;
        } else if (itemType === "티켓(꽃)") {
            let statusString = "";
            if (app.status && app.status !== "seller_waiting_for_info") {
                statusString = `${app.status} `;
            }
            mainContent += `티켓(꽃) ${statusString}${quantity}개 개당 ${unit.toLocaleString()}원${
                alt ? ` (접속시 ${alt.toLocaleString()}원)` : ""
            }`;
        }

        return `${tomorrowTag}${statusTag}${mainContent}`;
    };

    if (loading && applications.length === 0) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                로딩 중...
            </div>
        );
    }

    if (sessionStatus !== "authenticated") {
        router.push("/auth/signin");
        return null;
    }

    if (error) {
        return (
            <div className="flex justify-center items-center min-h-screen text-red-500">
                오류: {error}
            </div>
        );
    }

    if (!userId) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                사용자 정보 로딩 중...
            </div>
        );
    }

    return (
        <main className="max-w-md mx-auto p-4">
            <TabBar />
            <h2 className="text-xl font-bold text-center mb-3">거래 페이지 (구매자)</h2>

            <div className="flex justify-center gap-4 mb-3">
                {["전체", "진행중", "내일 거래"].map((tab) => (
                    <button
                        key={tab}
                        onClick={() => {
                            setActiveTab(tab as typeof activeTab);
                            setFilterItem("저금통");
                            setFilterStatus("전체");
                            setSortOption("기본");
                        }}
                        className={`relative px-3 py-1 text-xs rounded-full font-semibold border ${
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
                <div className="mb-4 flex gap-2 text-xs">
                    {activeTab === "전체" && (
                        <>
                            <select
                                className="flex-1 border rounded px-2 py-1"
                                value={filterItem}
                                onChange={(e) => {
                                    setFilterItem(e.target.value);
                                }}
                            >
                                <option value="저금통">저금통</option>
                                <option value="티켓(꽃)">티켓(꽃)</option>
                                <option value="낚시도움">낚시도움</option>
                            </select>

                            {filterItem === "티켓(꽃)" && (
                                <select
                                    className="flex-1 border rounded px-2 py-1"
                                    value={filterStatus}
                                    onChange={(e) => {
                                        setFilterStatus(e.target.value);
                                    }}
                                >
                                    <option value="전체">전체 상태</option>
                                    <option value="미접">미접</option>
                                    <option value="접속">접속</option>
                                </select>
                            )}
                        </>
                    )}

                    <select
                        className="flex-1 border rounded px-2 py-1"
                        value={sortOption}
                        onChange={(e) => {
                            setSortOption(e.target.value);
                        }}
                    >
                        {activeTab === "전체" && (
                            <>
                                <option value="기본">기본 정렬</option>
                                <option value="가격높은순">가격 높은 순</option>
                                <option value="가격낮은순">가격 낮은 순</option>
                                <option value="수량많은순">수량 많은 순</option>
                                <option value="수량적은순">수량 적은 순</option>
                            </>
                        )}
                        {activeTab === "내일 거래" && (
                            <>
                                <option value="기본">기본 정렬</option>
                                <option value="가격낮은순">가격 낮은 순</option>
                                <option value="수량많은순">수량 많은 순</option>
                                <option value="수량적은순">수량 적은 순</option>
                            </>
                        )}
                    </select>
                </div>
            )}

            {loading && applications.length === 0 ? (
                <p className="text-center text-gray-400">불러오는 중...</p>
            ) : applications.length === 0 && !loading ? (
                <p className="text-center text-gray-500">표시할 신청서가 없습니다.</p>
            ) : (
                <div className="space-y-2">
                    {applications.map((app) => {
                        const hasParticipated = app.participants?.includes(userId ?? "");
                        const isRejected = app.rejected === true;
                        const isClosed = app.closed === true;
                        
                        const canParticipate =
                            activeTab !== "진행중" &&
                            app.role === "seller" &&
                            !app.settled &&
                            !app.closed &&
                            !app.rejected &&
                            !hasParticipated &&
                            app.itemType !== "물고기";

                        const needsLinkSubmission = 
                            activeTab === "진행중" &&
                            hasParticipated &&
                            !app.settled &&
                            !app.closed &&
                            app.buyerLinkSent === false;

                        return (
                            <div
                                key={app.id}
                                onClick={() => navigateToDetailPage(app)}
                                className={`border p-3 rounded bg-white shadow-sm ${
                                    isRejected ? "border-red-500" : (isClosed ? "border-gray-400" : "border-gray-300")
                                } ${activeTab === "진행중" || app.itemType === "물고기" ? "cursor-pointer" : ""}`}
                            >
                                <p className="flex justify-between items-center text-sm">
                                    <span>{formatAppLine(app)}</span>
                                    {isRejected && (
                                        <span className="text-red-500 text-xs font-bold ml-2">
                                            ❌ 거절됨
                                        </span>
                                    )}
                                    {isClosed && !isRejected && activeTab !== "진행중" && (
                                        <span className="text-gray-500 text-xs font-bold ml-2">
                                            마감됨
                                        </span>
                                    )}
                                    {app.settled && (
                                        <span className="text-green-600 text-xs font-bold ml-2">
                                            ✅ 정산완료
                                        </span>
                                    )}
                                    {needsLinkSubmission && (
                                        <span className="relative flex h-3 w-3 ml-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                        </span>
                                    )}
                                </p>

                                {canParticipate && (
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleParticipate(app.id, app);
                                        }}
                                        className="mt-2 px-3 py-1 text-sm rounded bg-blue-500 text-white hover:bg-blue-600 transition"
                                    >
                                        구매하기
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
                                {loading ? '불러오는 중...' : '더보기'}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}