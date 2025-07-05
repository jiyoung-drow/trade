'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  increment,
  setDoc,
} from 'firebase/firestore';

export default function AdminRequestsPage() {
  const router = useRouter();
  const [chargeRequests, setChargeRequests] = useState<any[]>([]);
  const [withdrawRequests, setWithdrawRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuthAndFetch = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          alert('로그인이 필요합니다.');
          router.push('/admin/login');
          return;
        }

        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.data();
        if (!data || (data.role !== 'superadmin' && data.role !== 'admin')) {
          alert('접근 권한이 없습니다.');
          router.push('/admin/login');
          return;
        }

        // 충전 요청 구독
        const unsubCharge = onSnapshot(
          collection(db, 'chargeRequests'),
          (snapshot) => {
            const fetched = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setChargeRequests(fetched.filter((r) => r.status === '대기중'));
          }
        );

        // 출금 요청 구독
        const unsubWithdraw = onSnapshot(
          collection(db, 'withdrawRequests'),
          (snapshot) => {
            const fetched = snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));
            setWithdrawRequests(fetched.filter((r) => r.status === '대기중'));
          }
        );

        setLoading(false);

        return () => {
          unsubCharge();
          unsubWithdraw();
        };
      });
    };

    checkAuthAndFetch();
  }, [router]);

  /** ✅ 충전 승인 */
  const handleApproveCharge = async (request: any) => {
    if (!confirm(`충전 ${request.amount}원을 승인하시겠습니까?`)) return;

    const balanceRef = doc(db, 'balances', request.uid);
    const balanceSnap = await getDoc(balanceRef);

    if (!balanceSnap.exists()) {
      // 문서가 없으면 자동 생성 후 승인 처리
      await setDoc(balanceRef, { amount: request.amount });
    } else {
      // 문서가 있으면 금액 증가
      await updateDoc(balanceRef, { amount: increment(request.amount) });
    }

    await updateDoc(doc(db, 'chargeRequests', request.id), { status: '승인됨' });
    alert('충전이 승인되었습니다.');
  };

  /** ✅ 충전 거절 */
  const handleRejectCharge = async (request: any) => {
    const reason = prompt('거절 사유를 입력하세요:', '사유 없음');
    if (!reason) return;

    await updateDoc(doc(db, 'chargeRequests', request.id), {
      status: '거절됨',
      reason,
    });
    alert('충전이 거절되었습니다.');
  };

  /** ✅ 출금 승인 */
  const handleApproveWithdraw = async (request: any) => {
    if (!confirm(`출금 ${request.amount}원을 승인하시겠습니까?`)) return;

    const balanceRef = doc(db, 'balances', request.uid);
    const balanceSnap = await getDoc(balanceRef);

    if (!balanceSnap.exists()) {
      alert('해당 사용자의 보유금액 문서가 존재하지 않아 출금을 승인할 수 없습니다.');
      return;
    }

    await updateDoc(balanceRef, { amount: increment(-request.amount) });
    await updateDoc(doc(db, 'withdrawRequests', request.id), { status: '승인됨' });
    alert('출금이 승인되었습니다.');
  };

  /** ✅ 출금 거절 */
  const handleRejectWithdraw = async (request: any) => {
    const reason = prompt('거절 사유를 입력하세요:', '사유 없음');
    if (!reason) return;

    await updateDoc(doc(db, 'withdrawRequests', request.id), {
      status: '거절됨',
      reason,
    });
    alert('출금이 거절되었습니다.');
  };

  if (loading) return <div className="p-6 text-center">로딩 중...</div>;

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-bold">💰 충전/출금 승인 페이지</h1>

      {/* 충전 요청 */}
      <div>
        <h2 className="font-semibold text-lg mb-2">충전 요청</h2>
        {chargeRequests.length === 0 ? (
          <p className="text-gray-600">대기중인 충전 요청이 없습니다.</p>
        ) : (
          chargeRequests.map((req) => (
            <div
              key={req.id}
              className="border rounded p-3 mb-2 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold">{req.name || req.uid}</div>
                <div className="text-sm text-gray-600">
                  요청 금액: {req.amount.toLocaleString()}원
                </div>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleApproveCharge(req)}
                  className="bg-green-500 text-white text-sm px-3 py-1 rounded hover:bg-green-600"
                >
                  승인
                </button>
                <button
                  onClick={() => handleRejectCharge(req)}
                  className="bg-red-500 text-white text-sm px-3 py-1 rounded hover:bg-red-600"
                >
                  거절
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* 출금 요청 */}
      <div>
        <h2 className="font-semibold text-lg mb-2">출금 요청</h2>
        {withdrawRequests.length === 0 ? (
          <p className="text-gray-600">대기중인 출금 요청이 없습니다.</p>
        ) : (
          withdrawRequests.map((req) => (
            <div
              key={req.id}
              className="border rounded p-3 mb-2 flex justify-between items-center"
            >
              <div>
                <div className="font-semibold">{req.name || req.uid}</div>
                <div className="text-sm text-gray-600">
                  요청 금액: {req.amount.toLocaleString()}원
                </div>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => handleApproveWithdraw(req)}
                  className="bg-blue-500 text-white text-sm px-3 py-1 rounded hover:bg-blue-600"
                >
                  승인
                </button>
                <button
                  onClick={() => handleRejectWithdraw(req)}
                  className="bg-red-500 text-white text-sm px-3 py-1 rounded hover:bg-red-600"
                >
                  거절
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
