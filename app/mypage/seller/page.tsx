'use client';
import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function SellerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const q = query(
          collection(db, 'requests'),
          where('sellerId', '==', currentUser.uid),
          where('status', '==', 'pending')
        );
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          setRequests(data);
        });
        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribeAuth();
  }, []);

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">판매자 마이페이지</h1>
      {requests.length === 0 ? (
        <p>진행 중인 신청서가 없습니다.</p>
      ) : (
        requests.map((req) => (
          <div key={req.id} className="border p-2 rounded mb-2">
            <p>항목: {req.item}</p>
            <p>수량: {req.quantity}</p>
            <p>개당 가격: {req.originalPrice.toLocaleString()}원</p> {/* 비밀가격 표시 안 함 */}
          </div>
        ))
      )}
    </div>
  );
}