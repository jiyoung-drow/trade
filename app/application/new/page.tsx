'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function ApplicationNewPage() {
  const [user, setUser] = useState<User | null>(null);
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [pricePerItem, setPricePerItem] = useState('');
  const [altPricePerItem, setAltPricePerItem] = useState('');
  const [fishType, setFishType] = useState('');
  const [fishName, setFishName] = useState('');
  const [fishPrice, setFishPrice] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) setUser(currentUser);
      else router.push('/');
    });
    return () => unsubscribe();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!item || !quantity || !status || !user) {
      alert('모든 항목을 입력해주세요.');
      return;
    }

    let secretPrice = 0;
    if (status === '미접') secretPrice = 100;
    else if (status === '접속') secretPrice = 50;

    let basePrice = 0;

    if (item === '물고기') {
      if (!fishType || !fishName || !fishPrice) {
        alert('물고기 종류, 이름, 가격을 입력해주세요.');
        return;
      }
      let fishSecretAdd = 0;
      if (fishType === 'UR') fishSecretAdd = 500;
      else if (fishType === 'SSR') fishSecretAdd = 300;
      else if (fishType === 'SR') fishSecretAdd = 100;
      basePrice = Number(fishPrice) + fishSecretAdd;
    } else {
      if (!pricePerItem) {
        alert('개당 금액을 입력해주세요.');
        return;
      }
      basePrice = Number(pricePerItem);
    }

    // ✅ 역할(role) 필드 추가
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let role = '';
    if (userDoc.exists()) {
      const userData = userDoc.data();
      role = userData.role || '';
    } else {
      alert('사용자 정보를 불러올 수 없습니다.');
      return;
    }

    const data: any = {
      uid: user.uid,
      email: user.email,
      role, // ✅ 역할 필드 추가
      item,
      quantity: Number(quantity),
      status,
      pricePerItem: basePrice + secretPrice,
      createdAt: serverTimestamp(),
    };

    if (item === '물고기') {
      data.fishType = fishType;
      data.fishName = fishName;
      data.fishPrice = Number(fishPrice);
    }

    if (status === '미접' && altPricePerItem) {
      data.altPricePerItem = Number(altPricePerItem);
    }

    await addDoc(collection(db, 'applications'), data);

    alert('신청서가 등록되었습니다.');

    if (role === 'buyer') {
      router.push('/mypage/buyer');
    } else if (role === 'seller') {
      router.push('/mypage/seller');
    } else {
      router.push('/');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-xl font-bold mb-4">신청서 작성</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <select value={item} onChange={(e) => setItem(e.target.value)} className="w-full border rounded p-2" required>
          <option value="">항목 선택</option>
          <option value="티켓">티켓</option>
          <option value="꽃">꽃</option>
          <option value="물고기">물고기</option>
        </select>

        {item === '물고기' && (
          <>
            <select value={fishType} onChange={(e) => setFishType(e.target.value)} className="w-full border rounded p-2" required>
              <option value="">물고기 종류 선택</option>
              <option value="UR">UR</option>
              <option value="SSR">SSR</option>
              <option value="SR">SR</option>
            </select>
            <input type="text" placeholder="물고기 이름" value={fishName} onChange={(e) => setFishName(e.target.value)} className="w-full border rounded p-2" required />
            <input type="number" placeholder="물고기 가격" value={fishPrice} onChange={(e) => setFishPrice(e.target.value)} className="w-full border rounded p-2" required />
          </>
        )}

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded p-2" required>
          <option value="">상태 선택</option>
          <option value="미접">미접</option>
          <option value="접속">접속</option>
        </select>

        <input type="number" placeholder="수량" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-full border rounded p-2" required />

        {item !== '물고기' && (
          <input type="number" placeholder="개당 금액" value={pricePerItem} onChange={(e) => setPricePerItem(e.target.value)} className="w-full border rounded p-2" required />
        )}

        {status === '미접' && item !== '물고기' && (
          <input type="number" placeholder="만일 접속 시, 개당 금액" value={altPricePerItem} onChange={(e) => setAltPricePerItem(e.target.value)} className="w-full border rounded p-2" />
        )}

        <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded p-2">
          신청서 등록
        </button>
      </form>
    </div>
  );
}
