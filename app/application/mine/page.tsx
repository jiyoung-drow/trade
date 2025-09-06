"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { db } from "@/lib/firebase";
import {
    collection,
    query,
    where,
    getDocs,
    deleteDoc,
    doc,
    Timestamp,
    getDoc,
    updateDoc,
} from "firebase/firestore";
import { useRouter } from "next/navigation";
import TabBar from "@/components/TabBar";

interface Application {
    id: string;
    itemType?: string;
    quantity?: number;
    unitPrice?: number;
    altUnitPrice?: number;
    status?: string;
    fishName?: string;
    createdAt?: Timestamp;
    approved?: boolean;
    settled?: boolean;
    rejected?: boolean;
    uid?: string;
}

export default function MyApplicationsPage() {
    const { data: session, status } = useSession();
    const [applications, setApplications] = useState<Application[]>([]);
    const [loading, setLoading] = useState(false);
    const [role, setRole] = useState<"buyer" | "seller" | null>(null);
    const router = useRouter();

    const fetchApplications = async () => {
        if (!session?.user?.id || role === null) {
            console.log("Session ID or role is null/loading. Skipping fetchApplications.");
            setApplications([]);
            return;
        }

        try {
            const userId = session.user.id;
            console.log(`[${role}] Querying applications where uid == ${userId}`);
            const q = query(
                collection(db, "applications"),
                where("uid", "==", userId)
            );

            const snap = await getDocs(q);
            console.log(`[${role}] Raw documents fetched: ${snap.docs.length}`);

            const now = new Date();

            const data = snap.docs
                .map((doc) => ({
                    id: doc.id,
                    ...(doc.data() as Omit<Application, "id">),
                }))
                .filter((app) => {
                    if (!app.createdAt) {
                        return false;
                    }

                    const diffInMs = now.getTime() - app.createdAt.toDate().getTime();
                    const diffInDays = diffInMs / (1000 * 60 * 60 * 24);

                    const isVisible = (
                        diffInDays <= 7 &&
                        !app.approved &&
                        !app.settled &&
                        !app.rejected
                    );
                    
                    return isVisible;
                });

            data.sort((a, b) => {
                const dateA = a.createdAt?.toDate()?.getTime() || 0;
                const dateB = b.createdAt?.toDate()?.getTime() || 0;
                return dateB - dateA;
            });

            console.log(`[${role}] Filtered applications to display: ${data.length}`);
            setApplications(data);
        } catch (error) {
            console.error("Error fetching applications:", error);
            setApplications([]);
        }
    };

    const fetchRole = async () => {
        if (!session?.user?.id) {
            setRole(null);
            return;
        }
        try {
            const snap = await getDoc(doc(db, "users", session.user.id));
            const roleValue = snap.exists() ? snap.data().role : null;
            setRole(roleValue);
            console.log("User role fetched:", roleValue);
        } catch (e) {
            console.error("Error fetching role:", e);
            setRole(null);
        }
    };

    const handleDelete = async (app: Application) => {
        // Can only delete if not approved, not settled, not rejected
        if (app.approved || app.settled || app.rejected) {
            alert("이미 진행 중이거나 완료된 신청서는 삭제할 수 없습니다.");
            return;
        }

        if (app.uid !== session?.user?.id) {
            alert("자신이 작성한 신청서만 삭제할 수 있습니다.");
            return;
        }

        const confirmDelete = confirm("정말로 신청서를 삭제하시겠습니까?");
        if (!confirmDelete) return;

        try {
            setLoading(true);
            await deleteDoc(doc(db, "applications", app.id));
            alert("신청서가 삭제되었습니다.");
            await fetchApplications();
        } catch (error) {
            console.error("Error deleting application:", error);
            alert("삭제 중 오류가 발생했습니다.");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const d = String(date.getDate()).padStart(2, "0");
        return `${y}.${m}.${d}`;
    };

    useEffect(() => {
        if (status === "authenticated" && session?.user?.id) {
            fetchRole();
        } else if (status === "unauthenticated") {
            setRole(null);
        }
    }, [session, status]);

    useEffect(() => {
        if (status === "authenticated" && session?.user?.id && role !== null) {
            fetchApplications();
        } else if (status === "unauthenticated") {
            setApplications([]);
        }
    }, [session, role, status]);

    if (status === "loading") {
        return <div className="p-4 text-center">로딩 중...</div>;
    }

    if (!session) {
        return <div className="p-4 text-center">로그인 후 이용해 주세요.</div>;
    }

    return (
        <>
            <main className="max-w-md mx-auto p-4 space-y-4 font-sans pb-20">
                <h1 className="text-2xl font-extrabold text-center text-pink-500">
                    📋 내 신청서 보기
                </h1>

                {applications.length === 0 ? (
                    <p className="text-center text-gray-500 mt-8">
                        표시할 신청서가 없습니다.
                    </p>
                ) : (
                    <div className="space-y-2">
                        {applications.map((app) => {
                            const showDeleteButton = !app.approved && !app.settled && !app.rejected && app.uid === session?.user?.id;
                            const isPending = !app.approved && !app.rejected && !app.settled;

                            return (
                                <div
                                    key={app.id}
                                    className="flex items-center justify-between border rounded p-2 shadow-sm bg-white text-sm"
                                >
                                    <div className="flex-1 truncate">
                                        {`${app.itemType ?? "티켓/꽃"}`}
                                        {app.itemType === "물고기" && app.status && ` ${app.status}`}
                                        {app.itemType === "물고기" && app.fishName && ` ${app.fishName}`}
                                        {app.itemType !== "물고기" &&
                                            app.quantity !== undefined &&
                                            ` ${app.quantity}개`}
                                        {app.itemType !== "저금통" &&
                                            app.itemType !== "물고기" &&
                                            app.status &&
                                            ` ${app.status}`}
                                        {` ${app.unitPrice?.toLocaleString() ?? "0"}원`}
                                        {app.altUnitPrice
                                            ? ` (접속시 ${app.altUnitPrice.toLocaleString()}원)`
                                            : ""}
                                    </div>

                                    <div className="flex items-center space-x-2 ml-2">
                                        <span className="text-[11px] text-gray-400">
                                            {app.createdAt ? formatDate(app.createdAt.toDate()) : "-"}
                                        </span>
                                        {isPending && (
                                            <span className="text-xs text-blue-500 font-bold ml-2">
                                                (승인 대기중)
                                            </span>
                                        )}

                                        {showDeleteButton && (
                                            <button
                                                onClick={() => handleDelete(app)}
                                                disabled={loading}
                                                className="text-xs text-white bg-red-400 hover:bg-red-500 px-2 py-1 rounded transition disabled:opacity-50"
                                            >
                                                삭제
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            <div className="fixed bottom-0 left-0 right-0 bg-white border-t z-50">
                <TabBar />
            </div>
        </>
    );
}