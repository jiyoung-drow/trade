import { db } from "@/lib/firebase";
import { collection, addDoc, getDocs } from "firebase/firestore";
import { NextResponse } from "next/server";

export async function GET() {
  const snapshot = await getDocs(collection(db, "items"));
  const items = snapshot.docs.map((doc) => doc.data());
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const data = await req.json();
  const docRef = await addDoc(collection(db, "items"), data);
  return NextResponse.json({ success: true, id: docRef.id });
}
