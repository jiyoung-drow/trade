'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

interface Item {
  id: string;
  title?: string;
  price?: number;
  sellerId?: string;
  buyerId?: string;
  status?: string;
  hiddenPrice?: number;
  [key: string]: any;
}

export default function SellerTradeListPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [myRequests, setMyRequests] = useState<Item[]>([]);
  const [buyerRequests, setBuyerRequests] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      setUser(currentUser);
      fetchData(currentUser);
    });

    const fetchData = async (currentUser: FirebaseUser) => {
      try {
        const snapshot = await getDocs(collection(db, 'items'));

        const myReq = snapshot.docs
          .map((doc) => {
            const data = doc.data() as Item;
            return { ...data, id: doc.id };
          })
          .filter(
            (item) =>
              item.sellerId === currentUser.uid &&
              item.status === 'waiting'
          );

        const buyerReq = snapshot.docs
          .map((doc) => {
            const data = doc.data() as Item;
            return { ...data, id: doc.id };
          })
          .filter(
            (item) =>
              item.buyerId !== currentUser.uid &&
              !item.sellerId &&
              item.status === 'waiting'
          )
          .map((item) => ({
            ...item,
            hiddenPrice: Number(item.price ?? 0) - 100,
          }));

        setMyRequests(myReq);
        setBuyerRequests(buyerReq);
      } catch (error) {
        console.error(error);
        alert('데이터를 불러오는 중 오류가 발생했습니다.');
      } finally {
        setLoading(false);
      }
    };

    return () => unsubscribe();
  }, [router]);

  const handleSell = async (itemId: string) => {
    if (!user) return;
    const confirmSell = confirm('이 신청서를 판매하시겠습니까?\n구매자 승인 후 거래가 시작됩니다.');
    if (!confirmSell) return;

    try {
      await updateDoc(doc(db, 'items', itemId), {
        sellerId: user.uid,
        status: 'pendingApproval',
      });
      alert('판매 요청 완료. 구매자 승인을 기다립니다.');
      router.refresh();
    } catch (error) {
      console.error(error);
      alert('판매 요청 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return <div className="p-6 text-center">로딩 중...</div>;
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">🛠️ 판매자 거래목록</h1>

      {/* 1️⃣ 내 신청서 */}
      <h2 className="text-lg font-semibold mb-2">내 신청서</h2>
      {myRequests.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">작성한 신청서가 없습니다.</p>
      ) : (
        myRequests.map((item) => (
          <div
            key={item.id}
            className="border-2 border-green-500 rounded p-3 mb-2 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{item.title ?? '제목 없음'}</div>
              <div className="text-sm text-gray-600">
                {Number(item.price ?? 0).toLocaleString()}원 (내 신청서)
              </div>
            </div>
          </div>
        ))
      )}

      {/* 2️⃣ 구매자 신청서 */}
      <h2 className="text-lg font-semibold mt-6 mb-2">구매자 신청서</h2>
      {buyerRequests.length === 0 ? (
        <p className="text-sm text-gray-500">판매할 수 있는 구매자 신청서가 없습니다.</p>
      ) : (
        buyerRequests.map((item) => (
          <div
            key={item.id}
            className="border rounded p-3 mb-2 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{item.title ?? '제목 없음'}</div>
              <div className="text-sm text-gray-600">
                가격: {Number(item.hiddenPrice ?? 0).toLocaleString()}원 (숨겨진 금액)
              </div>
            </div>
            <button
              onClick={() => handleSell(item.id)}
              className="bg-orange-500 text-white text-sm px-3 py-1 rounded hover:bg-orange-600"
            >
              판매하기
            </button>
          </div>
        ))
      )}
    </div>
  );
}
