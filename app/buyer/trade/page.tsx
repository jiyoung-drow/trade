'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

export default function BuyerTradeListPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myRequests, setMyRequests] = useState<any[]>([]);
  const [sellerItems, setSellerItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (currentUser: any) => {
      const snapshot = await getDocs(collection(db, 'items'));

      // 구매자가 작성한 신청서
      const myReq = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((item) => item.buyerId === currentUser.uid && item.status === 'waiting');

      // 판매자가 작성한 신청서
      const sellerReq = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter(
          (item) =>
            item.sellerId !== currentUser.uid &&
            item.status === 'waiting' &&
            !item.buyerId // 아직 거래되지 않은 신청서만
        )
        .map((item) => ({
          ...item,
          hiddenPrice: item.price + 100 // 예: 상태/숨김 수수료 적용
        }));

      setMyRequests(myReq);
      setSellerItems(sellerReq);
      setLoading(false);
    };

    onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        alert('로그인이 필요합니다.');
        router.push('/login');
        return;
      }
      setUser(currentUser);
      fetchData(currentUser);
    });
  }, [router]);

  const handleBuy = async (itemId: string) => {
    if (!user) return;
    const confirmBuy = confirm('이 신청서를 구매하시겠습니까?');
    if (!confirmBuy) return;

    await updateDoc(doc(db, 'items', itemId), {
      buyerId: user.uid,
      status: 'in-progress'
    });

    // 거래 진행 페이지로 이동
    router.push(`/trade/${itemId}`);
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-4">🛒 구매자 거래목록</h1>

      {/* 1️⃣ 내 신청서 고정 */}
      <h2 className="text-lg font-semibold mb-2">내 신청서</h2>
      {myRequests.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">작성한 신청서가 없습니다.</p>
      ) : (
        myRequests.map((item) => (
          <div
            key={item.id}
            className="border-2 border-blue-500 rounded p-3 mb-2 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{item.title}</div>
              <div className="text-sm text-gray-600">{item.price}원 (내 신청서)</div>
            </div>
          </div>
        ))
      )}

      {/* 2️⃣ 판매자 신청서 리스트 */}
      <h2 className="text-lg font-semibold mt-6 mb-2">판매자 신청서</h2>
      {sellerItems.length === 0 ? (
        <p className="text-sm text-gray-500">구매 가능한 신청서가 없습니다.</p>
      ) : (
        sellerItems.map((item) => (
          <div
            key={item.id}
            className="border rounded p-3 mb-2 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{item.title}</div>
              <div className="text-sm text-gray-600">가격: {item.hiddenPrice}원 (숨겨진 가격)</div>
            </div>
            <button
              onClick={() => handleBuy(item.id)}
              className="bg-green-500 text-white text-sm px-3 py-1 rounded hover:bg-green-600"
            >
              구매하기
            </button>
          </div>
        ))
      )}
    </div>
  );
}
