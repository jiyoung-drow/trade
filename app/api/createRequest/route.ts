import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}