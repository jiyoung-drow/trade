import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    try {
        // your logic
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
