'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  setDoc,
  deleteDoc,
  getDoc,
} from 'firebase/firestore';

export default function AdminRequestsPage() {
  const router = useRouter();
  const [chargeRequests, setChargeRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // 🔹 관리자 인증 + role 확인 보호
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/admin/login');
        return;
      }
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      const data = userDoc.data();

      if (data?.role !== 'admin' && data?.role !== 'superadmin') {
        alert('관리자 권한이 없습니다.');
        router.push('/admin/login');
        return;
      }

      // 권한 통과 후 데이터 로드
      fetchRequests();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  // 🔹 충전 요청 목록 가져오기
  const fetchRequests = async () => {
    const chargeSnap = await getDocs(collection(db, 'chargeRequests'));
    setChargeRequests(chargeSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  };

  // 🔹 충전 승인
  const handleApproveCharge = async (req) => {
    try {
      const userRef = doc(db, 'users', req.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      if (!userData) {
        alert('유저 정보가 없습니다.');
        return;
      }

      const chargeAmount = req.chargeAmount || 0;

      await updateDoc(userRef, {
        balance: (userData.balance || 0) + chargeAmount,
      });

      await updateDoc(doc(db, 'chargeRequests', req.id), {
        status: 'approved',
        processedAt: Timestamp.now(),
      });

      alert(`충전 승인 완료: ${chargeAmount.toLocaleString()}원 충전`);
      fetchRequests();
    } catch (error) {
      console.error(error);
      alert('승인 처리 중 오류가 발생했습니다.');
    }
  };

  // 🔹 충전 반려
  const handleRejectCharge = async (req) => {
    try {
      const rejectedRef = doc(db, 'rejectedChargeRequests', req.id);
      await setDoc(rejectedRef, {
        ...req,
        status: 'rejected',
        processedAt: Timestamp.now(),
      });
      await deleteDoc(doc(db, 'chargeRequests', req.id));

      alert('충전 요청이 반려되어 보관되었습니다.');
      fetchRequests();
    } catch (error) {
      console.error(error);
      alert('반려 처리 중 오류가 발생했습니다.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">관리자 충전 요청 처리 페이지</h1>

      <div>
        <h2 className="text-xl font-semibold">충전 요청 목록</h2>
        {chargeRequests.length === 0 ? (
          <p className="text-gray-500">현재 충전 요청이 없습니다.</p>
        ) : (
          chargeRequests.map((req) => (
            <div key={req.id} className="border p-3 rounded mt-2 space-y-1">
              <p>이메일: {req.email}</p>
              <p>입금자명: {req.payerName || '미입력'}</p>
              <p>충전 금액: {req.chargeAmount ? req.chargeAmount.toLocaleString() : 0}원</p>
              <p>상태: {req.status || '대기중'}</p>
              {req.status === 'approved' || req.status === 'rejected' ? (
                <p className="text-green-600">처리 완료</p>
              ) : (
                <div className="flex space-x-2">
                  <button
                    onClick={() => handleApproveCharge(req)}
                    className="bg-blue-500 hover:bg-blue-600 text-white rounded px-2 py-1"
                  >
                    승인
                  </button>
                  <button
                    onClick={() => handleRejectCharge(req)}
                    className="bg-red-500 hover:bg-red-600 text-white rounded px-2 py-1"
                  >
                    반려
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
