'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, addDoc, Timestamp, doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function ApplicationNewPage() {
  const router = useRouter();
  const [role, setRole] = useState<'buyer' | null>(null);
  const [item, setItem] = useState('');
  const [fishType, setFishType] = useState('');
  const [fishName, setFishName] = useState('');
  const [status, setStatus] = useState('미접');
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(0);
  const [connectedPrice, setConnectedPrice] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userSnap = await getDoc(doc(db, 'users', user.uid));
        if (userSnap.exists() && userSnap.data().role === 'buyer') {
          setRole('buyer');
        } else {
          alert('구매자만 신청서를 작성할 수 있습니다.');
          router.push('/');
        }
      } else {
        router.push('/login');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async () => {
    if (!item) return setMessage('항목을 선택해주세요.');
    if (item === '물고기' && (!fishType || !fishName)) return setMessage('물고기 종류/이름을 입력해주세요.');

    const user = auth.currentUser;
    if (!user) return setMessage('로그인이 필요합니다.');

    let secretPrice = price;
    if (item === '물고기') {
      if (fishType === 'UR') secretPrice += 500;
      if (fishType === 'SSR') secretPrice += 300;
      if (fishType === 'SR') secretPrice += 100;
    }

    const data: any = {
      item,
      quantity,
      price, // 구매자가 입력한 금액
      secretPrice, // 비밀 가산된 금액
      createdAt: Timestamp.now(),
      userId: user.uid,
      role: 'buyer',
    };

    if (item === '물고기') {
      data.fishType = fishType;
      data.fishName = fishName;
    } else {
      data.status = status;
      if (status === '미접' && connectedPrice !== null) {
        data.connectedPrice = connectedPrice;
      }
    }

    try {
      await addDoc(collection(db, 'applications'), data);
      alert('✅ 신청서가 작성되었습니다.');
      router.push('/dashboard/buyer');
    } catch (error) {
      console.error(error);
      setMessage('작성 중 오류가 발생했습니다.');
    }
  };

  if (!role) return <p className="p-4">권한 확인 중...</p>;

  return (
    <div className="max-w-md mx-auto p-4 space-y-2">
      <h1 className="text-xl font-bold">신청서 작성</h1>
      {message && <p className="text-red-600">{message}</p>}

      {/* 항목 선택 */}
      <label className="block">
        항목:
        <select value={item} onChange={(e) => setItem(e.target.value)} className="border p-1 rounded w-full">
          <option value="">선택하세요</option>
          <option value="물고기">물고기</option>
          <option value="티켓">티켓</option>
          <option value="꽃">꽃</option>
        </select>
      </label>

      {/* 물고기 입력 */}
      {item === '물고기' && (
        <>
          <label className="block">
            종류:
            <select value={fishType} onChange={(e) => setFishType(e.target.value)} className="border p-1 rounded w-full">
              <option value="">선택</option>
              <option value="UR">UR</option>
              <option value="SSR">SSR</option>
              <option value="SR">SR</option>
            </select>
          </label>
          <label className="block">
            이름:
            <input type="text" value={fishName} onChange={(e) => setFishName(e.target.value)} className="border p-1 rounded w-full" />
          </label>
        </>
      )}

      {/* 티켓/꽃 입력 */}
      {(item === '티켓' || item === '꽃') && (
        <>
          <label className="block">
            상태:
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="border p-1 rounded w-full">
              <option value="미접">미접</option>
              <option value="접속">접속</option>
            </select>
          </label>
          {status === '미접' && (
            <label className="block text-sm text-gray-600">
              접속 시 개당 금액:
              <input
                type="number"
                value={connectedPrice ?? ''}
                onChange={(e) => setConnectedPrice(Number(e.target.value))}
                className="border p-1 rounded w-full"
              />
            </label>
          )}
        </>
      )}

      {/* 공통 */}
      <label className="block">
        수량:
        <input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value))} className="border p-1 rounded w-full" />
      </label>

      <label className="block">
        개당 가격:
        <input type="number" value={price} onChange={(e) => setPrice(parseInt(e.target.value))} className="border p-1 rounded w-full" />
      </label>

      <button onClick={handleSubmit} className="bg-blue-600 text-white w-full py-2 rounded hover:bg-blue-700">
        신청서 작성 완료
      </button>
    </div>
  );
}
