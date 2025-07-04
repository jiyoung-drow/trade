import { adminDb } from '@/lib/firebase-admins';
import { Timestamp } from 'firebase-admin/firestore';

export async function purchaseRequest(requestId: string, buyerId: string) {
  const requestRef = adminDb.collection('requests').doc(requestId);
  await requestRef.update({
    isPurchased: true,
    buyerId,
    status: 'pending',
    purchasedAt: Timestamp.now(),
  });
}
