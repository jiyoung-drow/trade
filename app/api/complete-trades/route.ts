import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const { itemId } = await req.json();
    if (!itemId) {
      return NextResponse.json({ success: false, error: "itemId missing" });
    }

    const itemRef = adminDb.collection("items").doc(itemId);
    const itemSnap = await itemRef.get();
    if (!itemSnap.exists) {
      return NextResponse.json({ success: false, error: "item not found" });
    }

    const item = itemSnap.data();
    const price = item.price;
    const feeRate = 0.05;
    const fee = Math.floor(price * feeRate);
    const sellerAmount = price - fee;

    const buyerRef = adminDb.collection("users").doc(item.buyerId);
    const sellerRef = adminDb.collection("users").doc(item.sellerId);

    await adminDb.runTransaction(async (t) => {
      const buyerDoc = await t.get(buyerRef);
      const sellerDoc = await t.get(sellerRef);

      const buyerBalance = buyerDoc.data()?.balance ?? 0;
      const sellerBalance = sellerDoc.data()?.balance ?? 0;

      if (buyerBalance < price) {
        throw new Error("Buyer does not have enough balance");
      }

      t.update(buyerRef, { balance: buyerBalance - price });
      t.update(sellerRef, { balance: sellerBalance + sellerAmount });
      t.update(itemRef, { status: "completed", completedAt: new Date() });
    });

    await adminDb.collection("fees").add({
      itemId,
      amount: fee,
      createdAt: new Date(),
    });

    return NextResponse.json({ success: true, message: "Trade completed and settled." });
  } catch (error) {
    console.error("정산 오류:", error);
    return NextResponse.json({ success: false, error: String(error) });
  }
}
