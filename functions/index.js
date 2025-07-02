/**
 * Firebase Functions: 거래 만료 / 거래 완료 정산 / 매월 출금 횟수 초기화
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

// ✅ 매월 1일 03:00 KST 출금 횟수 초기화
exports.resetWithdrawCountMonthly = functions.pubsub
  .schedule("0 18 0 1 *") // 매월 1일 18:00 UTC = KST 03:00
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    console.log("🪐 [RESET] 출금 횟수 초기화 시작");

    const usersSnapshot = await db.collection("users").get();
    const batch = db.batch();

    usersSnapshot.forEach((doc) => {
      const userRef = db.collection("users").doc(doc.id);
      batch.update(userRef, { withdrawCount: 0 });
    });

    await batch.commit();
    console.log(`✅ [RESET] ${usersSnapshot.size}명 초기화 완료`);
  });


// ✅ 거래 10분 초과 시 자동 만료 처리 (1분마다 실행)
exports.expireStaleTrades = functions.pubsub
  .schedule("every 1 minutes")
  .timeZone("Asia/Seoul")
  .onRun(async () => {
    console.log("⏳ [EXPIRE] 만료 검사 시작");

    const now = admin.firestore.Timestamp.now();
    const tenMinutesAgo = admin.firestore.Timestamp.fromMillis(Date.now() - 600000);

    const snapshot = await db.collection("items")
      .where("status", "==", "in-progress")
      .where("startedAt", "<", tenMinutesAgo)
      .get();

    const batch = db.batch();
    snapshot.forEach(doc => {
      batch.update(doc.ref, { status: "expired" });
    });

    await batch.commit();
    console.log(`✅ [EXPIRE] ${snapshot.size}건 만료 처리 완료`);
  });


// ✅ 거래 완료 시 정산 처리
exports.completeTrade = functions.firestore
  .document("items/{itemId}")
  .onUpdate(async (change, context) => {
    const beforeStatus = change.before.data().status;
    const afterStatus = change.after.data().status;

    if (beforeStatus !== "in-progress" && afterStatus === "completed") {
      console.log(`💰 [COMPLETE] 거래 ${context.params.itemId} 정산 처리 시작`);
      const data = change.after.data();
      const price = data.price;
      const feeRate = 0.05;
      const fee = Math.floor(price * feeRate);
      const sellerAmount = price - fee;

      const buyerId = data.buyerId;
      const sellerId = data.sellerId;

      const buyerRef = db.collection("users").doc(buyerId);
      const sellerRef = db.collection("users").doc(sellerId);

      await db.runTransaction(async (t) => {
        const buyerDoc = await t.get(buyerRef);
        const sellerDoc = await t.get(sellerRef);

        const buyerBalance = buyerDoc.data().balance || 0;
        const sellerBalance = sellerDoc.data().balance || 0;

        if (buyerBalance < price) {
          throw new Error("구매자 예치금 부족");
        }

        t.update(buyerRef, { balance: buyerBalance - price });
        t.update(sellerRef, { balance: sellerBalance + sellerAmount });
      });

      await db.collection("fees").add({
        itemId: context.params.itemId,
        amount: fee,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      await change.after.ref.update({
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✅ [COMPLETE] 거래 ${context.params.itemId} 정산 완료`);
    }
  });
