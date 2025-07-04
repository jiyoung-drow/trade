// app/api/signup/route.ts

import { NextResponse } from 'next/server';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, Timestamp } from 'firebase/firestore';

export async function POST(req: Request) {
  try {
    const { email, password, role } = await req.json();

    if (!email || !password || !role) {
      return NextResponse.json({ error: '모든 필드를 입력해주세요.' }, { status: 400 });
    }

    if (role !== 'buyer' && role !== 'seller') {
      return NextResponse.json({ error: '구매자 또는 판매자만 선택할 수 있습니다.' }, { status: 400 });
    }

    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    await setDoc(doc(db, 'users', user.uid), {
      email,
      role, // 'buyer' 또는 'seller'만 허용
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
