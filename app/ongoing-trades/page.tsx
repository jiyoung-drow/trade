'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function OngoingTradesPage() {
  const [user, setUser] = useState<User | null>(null);
  const [trades, setTrades] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const q = query(
          collection(db, 'trades'),
          where('participants', 'array-contains', currentUser.uid),
          where('status', '==', 'in-progress')
        );
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setTrades(data);
        });
        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">진행 중 거래</h1>
      {trades.length === 0 ? (
        <p>진행 중인 거래가 없습니다.</p>
      ) : (
        trades.map((trade) => (
          <div key={trade.id} className="border p-2 rounded mb-2">
            <p>거래 ID: {trade.id}</p>
            <p>항목: {trade.item}</p>
            <p>수량: {trade.quantity}</p>
            {/* 가격, 수수료 등은 비공개 */}
          </div>
        ))
      )}
    </div>
  );
}
