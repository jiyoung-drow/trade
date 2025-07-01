import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/admin';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const uid = json.uid;
    const role = json.role;

    if (!role) {
      return new Response(JSON.stringify({ error: "권한이 없습니다." }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!uid) {
      return NextResponse.json({ error: "UID가 없습니다." }, { status: 400 });
    }

    // Firebase Auth에서 유저 삭제
    await adminAuth.deleteUser(uid);

    // Firestore 'users' 컬렉션에서 유저 문서 삭제
    await adminDb.collection('users').doc(uid).delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('유저 삭제 오류:', error);
    return NextResponse.json({ error: "유저 삭제 중 오류가 발생했습니다." }, { status: 500 });
  }
}
