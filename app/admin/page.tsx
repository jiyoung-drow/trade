'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '@/lib/firebase';
import {
  collection,
  getDocs,
  deleteDoc,
  doc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Item {
  id: string;
  title?: string;
  price?: number;
  [key: string]: any;
}

export default function AdminPage() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetch = () => {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (!user) {
          alert('로그인이 필요합니다.');
          router.push('/admin/login');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.data();

        if (!data || (data.role !== 'admin' && data.role !== 'superadmin')) {
          alert('관리자 권한이 없습니다.');
          router.push('/admin/login');
          return;
        }

        const snapshot = await getDocs(collection(db, 'items'));
        const itemList: Item[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setItems(itemList);
        setLoading(false);
      });

      return () => unsubscribe();
    };

    checkAuthAndFetch();
  }, [router]);

  const handleDelete = async (id: string) => {
    const confirmDelete = confirm('정말 삭제하시겠습니까?');
    if (!confirmDelete) return;

    await deleteDoc(doc(db, 'items', id));
    setItems((prev) => prev.filter((item) => item.id !== id));
    alert('삭제 완료');
  };

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-xl font-bold mb-4">🛠️ 관리자 페이지 (아이템 관리)</h1>
      {items.length === 0 && <p>등록된 아이템이 없습니다.</p>}
      {items.map((item) => (
        <div
          key={item.id}
          className="border rounded p-3 mb-2 flex justify-between items-center"
        >
          <div>
            <div className="font-semibold">{item.title ?? '제목 없음'}</div>
            <div className="text-sm text-gray-600">
              {item.price?.toLocaleString() ?? 0}원
            </div>
          </div>
          <button
            onClick={() => handleDelete(item.id)}
            className="bg-red-500 text-white text-sm px-3 py-1 rounded hover:bg-red-600"
          >
            삭제
          </button>
        </div>
      ))}
    </div>
  );
}