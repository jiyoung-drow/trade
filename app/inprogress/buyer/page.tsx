'use client';

import { useEffect, useState } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, DocumentData } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function BuyerInProgressPage() {
  const [user, setUser] = useState<User | null>(null);
  const [trades, setTrades] = useState<DocumentData[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const q = query(
          collection(db, 'trades'),
          where('buyerId', '==', currentUser.uid),
          where('status', '==', 'in-progress')
        );
        const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setTrades(data);
        });
        return () => unsubscribeFirestore();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">진행 중 거래 (구매자)</h1>
      {trades.length === 0 ? (
        <p>진행 중인 거래가 없습니다.</p>
      ) : (
        trades.map(trade => (
          <div key={trade.id} className="border p-2 rounded mb-2">
            <p>항목: {trade.item}</p>
            <p>수량: {trade.quantity}</p>
            <p>상태: 진행 중</p>
          </div>
        ))
      )}
    </div>
  );
}
