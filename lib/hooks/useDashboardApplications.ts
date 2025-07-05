// lib/hooks/useDashboardApplications.ts

import { useEffect, useState } from "react";
import { fetchAvailableApplications, participateInApplication, deleteApplication } from "@/lib/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";

/**
 * @param role "buyer" | "seller"
 * 구매자: 판매자가 쓴 신청서만 가져옴
 * 판매자: 구매자가 쓴 신청서만 가져옴
 */
export function useDashboardApplications(role: "buyer" | "seller") {
  const [applications, setApplications] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage("로그인이 필요합니다.");
        return;
      }

      const fetchedApps = await fetchAvailableApplications(user.uid, role);
      const now = Date.now();
      const validApplications: any[] = [];

      for (const app of fetchedApps) {
        const createdAt = app.createdAt?.toDate().getTime() || 0;
        const elapsedSeconds = (now - createdAt) / 1000;

        if (elapsedSeconds > 600) {
          await deleteApplication(app.id);
        } else {
          validApplications.push(app);
        }
      }

      setApplications(validApplications);
    });

    return () => unsubscribe();
  }, [role]);

  const handleParticipate = async (appId: string) => {
    if (!auth.currentUser) {
      setMessage("로그인이 필요합니다.");
      return;
    }
    await participateInApplication(appId, auth.currentUser.uid);
    setMessage("✅ 거래 참여 완료");
  };

  return {
    applications,
    message,
    handleParticipate,
  };
}
