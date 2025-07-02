'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs } from 'firebase/firestore';

interface RequestItem {
  id: string;
  buyerName: string;
  itemName: string;
  quantity: number;
  status: string;
}

export default function AdminRequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          router.push('/admin/login');
          return;
        }

        const snapshot = await getDocs(collection(db, 'requests'));
        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<RequestItem, 'id'>),
        }));
        setRequests(data);
        setLoading(false);
      });

      return () => unsubscribe();
    };

    fetchRequests();
  }, [router]);

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-bold mb-4">📋 관리자 요청 목록</h1>
      {requests.length === 0 ? (
        <p className="text-center">요청이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {requests.map((request) => (
            <li key={request.id} className="border rounded p-3 shadow">
              <p><strong>구매자:</strong> {request.buyerName}</p>
              <p><strong>상품:</strong> {request.itemName}</p>
              <p><strong>수량:</strong> {request.quantity}</p>
              <p><strong>상태:</strong> {request.status}</p>
              {/* 필요 시 승인/반려 버튼 추가 가능 */}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
