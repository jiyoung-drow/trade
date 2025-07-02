const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function seedFirestore() {
  try {
    console.log("🌱 Firestore 시드 시작");

    // 1. Super Admin 생성
    const superAdminUid = "test-superadmin-uid";
    await db.collection("users").doc(superAdminUid).set({
      uid: superAdminUid,
      name: "슈퍼 관리자",
      email: "admin@test.com",
      role: "superadmin",
      bank: "카카오뱅크",
      account: "110123456789",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      balance: 0,
      dailyRequestCount: 0
    });
    console.log(`✅ Superadmin user ${superAdminUid} 생성 완료`);

    // 2. adminSettings/config 생성
    await db.collection("adminSettings").doc("config").set({
      allowBuyerCreate: true,
      allowSellerCreate: true,
      maxBuyerCreatePerDay: 3,
      feeRate: 0.05,
      customerSupportLink: "https://pf.kakao.com/_xxxx"
    });
    console.log(`✅ adminSettings/config 생성 완료`);

    // 3. 테스트 item 생성
    const itemRef = db.collection("items").doc();
    await itemRef.set({
      itemId: itemRef.id,
      title: "테스트 티켓",
      type: "ticket",
      price: 5000,
      adjustedPrice: 5100,
      status: "waiting",
      sellerId: superAdminUid,
      buyerId: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      fishType: "",
      fishName: ""
    });
    console.log(`✅ 테스트 item 생성 완료`);

    // 4. 테스트 transaction 생성
    const txnRef = db.collection("transactions").doc();
    await txnRef.set({
      transactionId: txnRef.id,
      itemId: itemRef.id,
      buyerId: "test-buyer-uid",
      sellerId: superAdminUid,
      price: 5000,
      fee: 250,
      status: "pending",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ 테스트 transaction 생성 완료`);

    console.log("🌱 Firestore 시드 완료");
    process.exit(0);
  } catch (error) {
    console.error("❌ Firestore 시드 중 오류:", error);
    process.exit(1);
  }
}

seedFirestore();
