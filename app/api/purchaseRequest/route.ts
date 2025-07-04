import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admins';
import { Timestamp } from 'firebase-admin/firestore';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { requestId, buyerId } = body;

    if (!requestId || !buyerId) {
      return NextResponse.json({ error: 'Missing requestId or buyerId' }, { status: 400 });
    }

    const requestRef = adminDb.collection('requests').doc(requestId);

    await requestRef.update({
      isPurchased: true,
      buyerId,
      status: 'pending',
      purchasedAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('purchaseRequest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
