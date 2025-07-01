'use client';

import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function SellerDashboard() {
  const [buyerApplications, setBuyerApplications] = useState<any[]>([]);
  const [message, setMessage] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setMessage('로그인이 필요합니다.');
        return;
      }
      try {
        const now = Date.now();
        const buyerQuery = query(
          collection(db, 'applications'),
          where('role', '==', 'buyer')
        );
        const buyerSnap = await getDocs(buyerQuery);
        const buyerList: any[] = [];

        for (const docSnap of buyerSnap.docs) {
          const data = docSnap.data() as { createdAt?: any; [key: string]: any };
          const appData = { id: docSnap.id, ...data };

          const createdAt = appData.createdAt?.toDate().getTime() || 0;
          const elapsedSeconds = (now - createdAt) / 1000;

          if (elapsedSeconds > 600) {
            await deleteDoc(doc(db, 'applications', appData.id));
          } else {
            buyerList.push(appData);
          }
        }
        setBuyerApplications(buyerList);
      } catch (error) {
        console.error(error);
        setMessage('신청서 불러오기 오류');
      }
    });
    return () => unsubscribe();
  }, []);

  const formatDisplay = (app: any) => {
    let display = '';

    if (app.item === '물고기') {
      display = `${app.fishName ?? ''} ${app.quantity}개 ${app.secretPrice ?? app.price}원`;
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

  const handleParticipate = async (appId: string) => {
    if (!confirm('해당 신청서 거래에 참여하시겠습니까?')) return;
    try {
      await updateDoc(doc(db, 'applications', appId), { status: '진행중', sellerId: auth.currentUser?.uid });
      alert('거래에 참여하였습니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('참여 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold mb-2">판매자 거래목록</h1>
      <p className="text-sm text-gray-600">
        구매자가 작성한 신청서 목록입니다. 10분 경과 시 자동 삭제되며, 참여 시 진행중 상태로 전환됩니다.
      </p>
      {message && <p className="text-red-600">{message}</p>}

      <div className="mt-4">
        {buyerApplications.map((app) => (
          <div key={app.id} className="border p-2 rounded mt-2 flex justify-between items-center">
            <span>{formatDisplay(app)}</span>
            <button
              onClick={() => handleParticipate(app.id)}
              className="bg-green-600 text-white text-sm px-2 py-1 rounded hover:bg-green-700 ml-2"
            >
              판매하기
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
