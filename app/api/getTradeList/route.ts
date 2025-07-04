import { adminDb } from '@/lib/firebase-admins';

export async function getTradeList(userId: string, role: 'buyer' | 'seller') {
  const snapshot = await adminDb.collection('requests').where('status', '==', 'waiting').get();
  const now = Date.now();
  const list: any[] = [];

  snapshot.forEach(doc => {
    const data = doc.data();
    const expiredAt = data.expiredAt?.toDate()?.getTime() || 0;

    if (expiredAt < now) return; // 유효기간 지난 신청서 제외

    if (role === 'buyer') {
      list.push({ id: doc.id, ...data }); // 구매자 신청서 삭제 ❌
    }

    if (role === 'seller') {
      if (data.userId === userId) {
        if (!data.isPurchased) { // 구매자가 구매하면 거래목록에서 삭제
          list.push({ id: doc.id, ...data });
        }
      } else {
        list.push({ id: doc.id, ...data }); // 판매자가 구매자 신청서 참여 가능, 삭제 ❌
      }
    }
  });

  return list;
}
