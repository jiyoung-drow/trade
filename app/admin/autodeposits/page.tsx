"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  Timestamp,
  getDocs,
  updateDoc,
  doc,
  increment,
  serverTimestamp,
} from "firebase/firestore";
import { format } from "date-fns";

interface AutoDeposit {
  id: string;
  name: string;
  amount: number;
  timestamp: Timestamp;
  matched?: boolean;
}

interface Transaction {
  id: string;
  senderName: string;
  amount: number;
  matched?: boolean;
  status: string;
  uid: string;
}

export default function AutoDepositsPage() {
  const [deposits, setDeposits] = useState<AutoDeposit[]>([]);

  useEffect(() => {
    const q = query(
      collection(db, "autodeposits"),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const autoDeposits: AutoDeposit[] = snapshot.docs.map((doc) => {
        const d = doc.data();
        return {
          id: doc.id,
          name: d.name?.trim() || "",
          amount: Number(d.amount),
          timestamp: d.timestamp,
          matched: d.matched || false,
        };
      });

      const txSnap = await getDocs(collection(db, "transactions"));
      const transactions: Transaction[] = txSnap.docs
        .map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            senderName: d.senderName?.trim() || "",
            amount: Number(d.amount),
            matched: d.matched || false,
            status: d.status,
            uid: d.uid,
          };
        })
        .filter((t) => t.status === "pending");

      for (const deposit of autoDeposits) {
        if (deposit.matched) continue;

        const match = transactions.find(
          (t) =>
            !t.matched &&
            t.senderName === deposit.name &&
            t.amount === deposit.amount
        );

        if (match) {
          await Promise.all([
            updateDoc(doc(db, "autodeposits", deposit.id), {
              matched: true,
            }),
            updateDoc(doc(db, "transactions", match.id), {
              matched: true,
              status: "approved",
              approvedAt: serverTimestamp(),
            }),
            updateDoc(doc(db, "users", match.uid), {
              balance: increment(match.amount),
              updatedAt: serverTimestamp(),
            }),
          ]);
        }
      }

      setDeposits(autoDeposits);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">입금 내역 자동 감지</h1>
      <div className="overflow-x-auto border rounded-md">
        <table className="w-full table-auto text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-2 text-left">이름</th>
              <th className="px-4 py-2 text-left">금액</th>
              <th className="px-4 py-2 text-left">입금 시각</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr
                key={d.id}
                className={`border-t ${
                  d.matched ? "bg-green-100" : "bg-white"
                }`}
              >
                <td className="px-4 py-2">{d.name}</td>
                <td className="px-4 py-2">{d.amount.toLocaleString()}원</td>
                <td className="px-4 py-2">
                  {format(d.timestamp.toDate(), "yyyy-MM-dd HH:mm:ss")}
                </td>
              </tr>
            ))}
            {deposits.length === 0 && (
              <tr>
                <td colSpan={3} className="text-center py-4 text-gray-500">
                  입금 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
