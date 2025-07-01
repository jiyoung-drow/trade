import { NextResponse } from 'next/server';
import adminAuth from '@/lib/adminAuth';
import adminDb from '@/lib/adminDb';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const uid = json.uid;

    if (!uid) {
      return NextResponse.json(
        { error: "권한이 없습니다. (UID 없음)" },
        { status: 400 }
      );
    }

    // Firebase Auth 에서 계정 삭제
    await adminAuth.deleteUser(uid);

    // Firestore 'users' 컬렉션에서 유저 문서 삭제
    await adminDb.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('유저 삭제 오류:', error);
    return NextResponse.json(
      { error: "유저 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
