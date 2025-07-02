const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function resetFirestore() {
  try {
    console.log("⚠️ Firestore 데이터 초기화 시작");

    const collectionsToDelete = [
      "users",
      "adminSettings",
      "items",
      "transactions",
      "chargeRequests",
      "withdrawRequests",
      "support",
    ];

    for (const col of collectionsToDelete) {
      const snapshot = await db.collection(col).get();
      const batch = db.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      console.log(`✅ ${col} 컬렉션 초기화 완료`);
    }

    console.log("🔥 Firestore 초기화 완료");
    process.exit(0);
  } catch (error) {
    console.error("❌ Firestore 초기화 중 오류:", error);
    process.exit(1);
  }
}

resetFirestore();
