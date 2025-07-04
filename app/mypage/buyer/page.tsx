'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { User } from 'firebase/auth';

export default function BuyerMyPage() {
  const [user, setUser] = useState<User | null>(null);
  const [applications, setApplications] = useState<any[]>([]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(
          collection(db, 'applications'),
          where('uid', '==', currentUser.uid)
        );
        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          setApplications(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsubscribeSnapshot();
      }
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">구매자 마이페이지</h1>
      {applications.length === 0 ? (
        <p>작성한 신청서가 없습니다.</p>
      ) : (
        applications.map((app) => (
          <div key={app.id} className="border rounded p-4 space-y-1">
            <p>항목: {app.item}</p>
            <p>수량: {app.quantity}</p>
            <p>상태: {app.status}</p>
            <p>작성일: {app.createdAt?.toDate().toLocaleString() ?? '---'}</p>
          </div>
        ))
      )}
    </div>
  );
}
