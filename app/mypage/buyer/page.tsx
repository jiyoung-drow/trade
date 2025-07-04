'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
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

  const handleDelete = async (id: string) => {
    if (confirm('해당 신청서를 삭제하시겠습니까?')) {
      await deleteDoc(doc(db, 'applications', id));
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold">구매자 마이페이지</h1>
      <div className="flex space-x-2">
        <button className="flex-1 bg-green-500 text-white rounded p-2">충전하기</button>
        <button className="flex-1 bg-blue-500 text-white rounded p-2">출금하기</button>
      </div>
      {applications.length === 0 ? (
        <p>작성한 신청서가 없습니다.</p>
      ) : (
        applications.map((app) => (
          <div key={app.id} className="border rounded p-4 space-y-1">
            <p>항목: {app.item}</p>
            <p>수량: {app.quantity}</p>
            <p>상태: {app.status}</p>
            <p>작성일: {app.createdAt?.toDate().toLocaleString() ?? '---'}</p>
            <button
              onClick={() => handleDelete(app.id)}
              className="bg-red-500 text-white rounded p-1 mt-2 w-full"
            >
              삭제
            </button>
          </div>
        ))
      )}
    </div>
  );
}
