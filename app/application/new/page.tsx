'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { onAuthStateChanged, User } from 'firebase/auth';

export default function ApplicationNewPage() {
  const [user, setUser] = useState<User | null>(null);
  const [item, setItem] = useState('');
  const [quantity, setQuantity] = useState('');
  const [status, setStatus] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [altUnitPrice, setAltUnitPrice] = useState('');
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

    const existingQuery = query(
      collection(db, 'applications'),
      where('uid', '==', user.uid),
      where('item', '==', item),
      where('status', 'in', ['미접', '접속', '진행중'])
    );

    const existingSnapshot = await getDocs(existingQuery);
    if (!existingSnapshot.empty) {
      alert(`이미 "${item}" 항목으로 작성한 신청서가 존재합니다.`);
      return;
    }

    let calculatedUnitPrice = 0;
    let priceIfConnected = null;

    if (item === '물고기') {
      if (!fishType || !fishName || !fishPrice) {
        alert('물고기 정보 입력 필요.');
        return;
      }
      let fishSecretAdd = 0;
      if (fishType === 'UR') fishSecretAdd = 500;
      else if (fishType === 'SSR') fishSecretAdd = 300;
      else if (fishType === 'SR') fishSecretAdd = 100;
      calculatedUnitPrice = Number(fishPrice) + fishSecretAdd;
    } else {
      if (!unitPrice) {
        alert('개당 금액을 입력해주세요.');
        return;
      }
      calculatedUnitPrice = Number(unitPrice);
      if (status === '미접' && altUnitPrice) {
        priceIfConnected = Number(altUnitPrice);
      }
    }

    const userDoc = await getDoc(doc(db, 'users', user.uid));
    let role = '';
    if (userDoc.exists()) {
      const userData = userDoc.data();
      role = userData.role || '';
    } else {
      alert('사용자 정보 불러오기 실패.');
      return;
    }

    const data: any = {
      uid: user.uid,
      email: user.email,
      role,
      item,
      quantity: Number(quantity),
      status,
      unitPrice: calculatedUnitPrice, // ✅ 개당가격으로 저장
      priceIfConnected,
      createdAt: serverTimestamp(),
    };

    if (item === '물고기') {
      data.fishType = fishType;
      data.fishName = fishName;
      data.fishPrice = Number(fishPrice);
    }

    await addDoc(collection(db, 'applications'), data);
    alert('신청서가 등록되었습니다.');

    if (role === 'buyer') router.push('/mypage/buyer');
    else if (role === 'seller') router.push('/mypage/seller');
    else router.push('/');
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
          <input type="number" placeholder="개당 금액" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} className="w-full border rounded p-2" required />
        )}

        {status === '미접' && item !== '물고기' && (
          <input type="number" placeholder="접속 시 개당 금액" value={altUnitPrice} onChange={(e) => setAltUnitPrice(e.target.value)} className="w-full border rounded p-2" />
        )}

        <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded p-2">
          신청서 등록
        </button>
      </form>
    </div>
  );
}
