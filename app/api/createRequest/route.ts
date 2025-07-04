import { adminDb } from '@/lib/firebase-admins';
import { Timestamp } from 'firebase-admin/firestore';

export async function createRequest(data: any, userId: string) {
  const expiredAt = Timestamp.fromMillis(Date.now() + 12 * 60 * 60 * 1000); // 12시간 후 만료
  const requestRef = adminDb.collection('requests').doc();

  await requestRef.set({
    ...data,
    userId,
    status: 'waiting',
    expiredAt,
    createdAt: Timestamp.now(),
  });
}
