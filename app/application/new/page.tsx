'use client';

import { useState } from 'react';
import { db } from '@/lib/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function ApplicationFormPage() {
  const router = useRouter();

  const [item, setItem] = useState('');
  const [fishType, setFishType] = useState('');
  const [fishName, setFishName] = useState('');
  const [status, setStatus] = useState('');
  const [quantity, setQuantity] = useState('');
  const [pricePerItem, setPricePerItem] = useState('');
  const [secretPrice, setSecretPrice] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!item || !status || !quantity || !pricePerItem) {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }

    let adjustedPrice = Number(pricePerItem);

    // 물고기 종류 추가금
    if (item === '물고기') {
      if (fishType === 'UR') adjustedPrice += 500;
      if (fishType === 'SSR') adjustedPrice += 300;
      if (fishType === 'SR') adjustedPrice += 100;
    }

    // 상태에 따른 추가금
    if (status === '미접') adjustedPrice += 100;
    if (status === '접속') adjustedPrice += 50;

    const applicationData = {
      item,
      fishType: item === '물고기' ? fishType : '',
      fishName: item === '물고기' ? fishName : '',
      status,
      quantity: Number(quantity),
      pricePerItem: Number(pricePerItem),
      adjustedPricePerItem: adjustedPrice,
      secretPrice,
      createdAt: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'applications'), applicationData);
      alert('신청서가 등록되었습니다.');
      router.push('/dashboard');
    } catch (error: unknown) {
      console.error('등록 오류:', error);
      alert('등록 중 오류가 발생했습니다.');
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">신청서 작성</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 항목 선택 */}
        <select
          value={item}
          onChange={(e) => setItem(e.target.value)}
          className="w-full border rounded p-2"
          required
        >
          <option value="">항목 선택</option>
          <option value="티켓">티켓</option>
          <option value="꽃">꽃</option>
          <option value="물고기">물고기</option>
        </select>

        {/* 물고기 선택 시 종류 입력 */}
        {item === '물고기' && (
          <>
            <select
              value={fishType}
              onChange={(e) => setFishType(e.target.value)}
              className="w-full border rounded p-2"
              required
            >
              <option value="">물고기 종류 선택</option>
              <option value="UR">UR (+500원)</option>
              <option value="SSR">SSR (+300원)</option>
              <option value="SR">SR (+100원)</option>
            </select>
            <input
              type="text"
              placeholder="물고기 이름"
              value={fishName}
              onChange={(e) => setFishName(e.target.value)}
              className="w-full border rounded p-2"
              required
            />
          </>
        )}

        {/* 상태 선택 */}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full border rounded p-2"
          required
        >
          <option value="">상태 선택</option>
          <option value="미접">미접 (+100원)</option>
          <option value="접속">접속 (+50원)</option>
        </select>

        {/* 수량 */}
        <input
          type="number"
          placeholder="수량"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          className="w-full border rounded p-2"
          required
        />

        {/* 개당 금액 */}
        <input
          type="number"
          placeholder="개당 금액"
          value={pricePerItem}
          onChange={(e) => setPricePerItem(e.target.value)}
          className="w-full border rounded p-2"
          required
        />

        {/* 비밀 가격 적용 */}
        <label className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={secretPrice}
            onChange={(e) => setSecretPrice(e.target.checked)}
          />
          <span>비밀 가격 적용</span>
        </label>

        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white rounded p-2 font-semibold"
        >
          신청서 등록
        </button>
      </form>
    </div>
  );
}