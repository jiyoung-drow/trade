'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function BuyerDashboard() {
  const [myApplications, setMyApplications] = useState<any[]>([]);
  const [sellerApplications, setSellerApplications] = useState<any[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage('로그인이 필요합니다.');
        return;
      }
      try {
        const now = Date.now();
        const myQuery = query(
          collection(db, 'applications'),
          where('userId', '==', user.uid),
          where('role', '==', 'buyer')
        );
        const mySnap = await getDocs(myQuery);
        const myList: any[] = [];

        for (const docSnap of mySnap.docs) {
          const appData = { id: docSnap.id, ...docSnap.data() };
          const createdAt = appData.createdAt?.toDate().getTime() || 0;
          const elapsedSeconds = (now - createdAt) / 1000;

          if (elapsedSeconds > 600) {
            // 10분 경과 시 자동 삭제
            await deleteDoc(doc(db, 'applications', appData.id));
            console.log(`만료된 신청서 자동 삭제: ${appData.id}`);
          } else {
            myList.push(appData);
          }
        }
        setMyApplications(myList);

        const sellerQuery = query(collection(db, 'applications'), where('role', '==', 'seller'));
        const sellerSnap = await getDocs(sellerQuery);
        const sellerList = sellerSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setSellerApplications(sellerList);
      } catch (error) {
        console.error(error);
        setMessage('신청서 불러오기 중 오류가 발생했습니다.');
      }
    });
    return () => unsubscribe();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('이 신청서를 삭제하시겠습니까?')) return;
    try {
      await deleteDoc(doc(db, 'applications', id));
      alert('삭제되었습니다.');
      location.reload();
    } catch (error) {
      console.error(error);
      alert('삭제 중 오류가 발생했습니다.');
    }
  };

  const formatDisplay = (app: any) => {
    let display = '';
    if (app.item === '물고기') {
      display = `물고기 ${app.quantity}개 ${app.price}원`; // 비밀 가산 가격 표시 X
    } else {
      display = `${app.item} ${app.status} ${app.quantity}개 ${app.price}원`;
    }

    const now = Date.now();
    const createdAt = app.createdAt?.toDate().getTime() || 0;
    const elapsed = (now - createdAt) / 1000;
    const remain = 600 - elapsed;
    const min = Math.floor(remain / 60);
    const sec = Math.floor(remain % 60);

    display += ` - ${min}분 ${sec}초 남음`;

    return display;
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">구매자 거래목록</h1>
      <p className="text-sm text-gray-600">
        내 신청서는 상단 고정되며 10분이 지나면 자동 삭제됩니다. 필요시 수동 삭제도 가능합니다.
      </p>
      {message && <p className="text-red-600">{message}</p>}

      {/* ✅ 내 신청서 */}
      {myApplications.length > 0 && (
        <div className="border-2 border-blue-500 p-2 rounded mt-4">
          <p className="font-semibold">내 신청서</p>
          {myApplications.map((app) => (
            <div
              key={app.id}
              className="border p-2 rounded mt-2 flex justify-between items-center"
            >
              <span>{formatDisplay(app)}</span>
              <button
                onClick={() => handleDelete(app.id)}
                className="bg-red-500 text-white px-2 py-1 rounded ml-2 text-sm"
              >
                삭제
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ✅ 판매자 신청서 */}
      <div className="mt-4">
        {sellerApplications.map((app) => (
          <div key={app.id} className="border p-2 rounded mt-2">
            {formatDisplay(app)}
          </div>
        ))}
      </div>
    </div>
  );
}
