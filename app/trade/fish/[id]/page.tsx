"use client";

import { useState, useEffect } from "react"; // ⭐ 수정: 여기서 오류가 발생했습니다.
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  doc,
  getDoc,
  updateDoc,
  runTransaction,
  Timestamp,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase"; 
import TabBar from "@/components/TabBar";

interface Application {
  id: string;
  uid: string; // 신청서 작성자(판매자 또는 구매자)의 UID
  email: string; // 신청서 작성자의 이메일
  role: "buyer" | "seller"; // 신청서 생성 시의 역할 (이 신청서가 구매 요청인지 판매 요청인지)
  itemType: string;
  status: string | null;
  fishName: string | null;
  quantity: number;
  unitPrice: number;
  altUnitPrice: number | null;
  todayOrTomorrow: "today" | "tomorrow";
  approved: boolean;
  rejected: boolean;
  closed: boolean;
  settled: boolean;
  createdAt: Timestamp;
  participants: string[]; // 이 신청서에 참여한 사용자들 (반대 역할)의 UID
  tradeLink?: string;
  sellerAccount?: string;
  buyerConfirmedLink?: boolean;
  buyerRejectedLink?: boolean;
  buyerSettlementClicked?: boolean;
  sellerFinalSettlementClicked?: boolean;
  buyerReturnAmount?: number; // 구매자에게 최종 반환될 금액 필드
}

interface UserData {
  role: "buyer" | "seller";
  balance: number;
  // bankAccount?: string; // users 문서에서 bankAccount를 직접 가져오지 않고 saved_infos에서 가져올 것이므로 제거
}

interface SavedInfo {
  id: string;
  name: string; // 은행명 필드 추가
  value: string;
  userId: string;
}

export default function FishDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const { data: session, status } = useSession();
  const router = useRouter();

  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<"buyer" | "seller" | null>(null);
  const [fees, setFees] = useState<Record<string, number>>({}); // 수수료 설정을 위한 상태 추가

  const [linkInput, setLinkInput] = useState("");
  const [accountInput, setAccountInput] = useState(""); // 판매자 계좌번호 입력 필드 상태

  // 계좌번호를 saved_infos에서 가져와 accountInput에 설정하는 함수
  const fetchAndSetAccount = async () => {
    if (!session?.user?.id) {
      console.log("DEBUG: [fetchAndSetAccount] 세션 사용자 ID 없음.");
      return;
    }
    setLoading(true);
    try {
      const savedInfosRef = collection(db, "saved_infos");
      // '국민' 계좌를 예시로 가져옵니다. 필요에 따라 다른 계좌 이름을 사용할 수 있습니다.
      const q = query(savedInfosRef, where("userId", "==", session.user.id), where("name", "==", "국민")); 
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        const savedAccount = querySnapshot.docs[0].data() as SavedInfo;
        // 은행명과 계좌번호를 함께 포맷하여 입력 필드에 설정
        setAccountInput(`${savedAccount.name} ${savedAccount.value}`); 
        console.log("DEBUG: [fetchAndSetAccount] 저장된 계좌번호 가져오기 성공.");
      } else {
        console.log("DEBUG: [fetchAndSetAccount] 저장된 국민은행 계좌번호를 찾을 수 없습니다.");
        alert("저장된 국민은행 계좌번호를 찾을 수 없습니다. 직접 입력해주세요."); // 가져오기 버튼 클릭 시에만 alert
      }
    } catch (err) {
      console.error("DEBUG: [fetchAndSetAccount] 계좌번호 가져오기 오류:", err);
      alert("계좌번호를 가져오는 데 실패했습니다. 직접 입력해주세요."); // 가져오기 버튼 클릭 시에만 alert
    } finally {
      setLoading(false);
    }
  };

  // 수수료 설정을 불러오는 함수 추가
  const fetchFeeSettings = async () => {
    try {
      const snap = await getDoc(doc(db, "admin_settings", "fee_settings"));
      if (snap.exists()) {
        setFees(snap.data() as Record<string, number>);
        console.log("DEBUG: [fetchFeeSettings] 수수료 설정 로드 완료:", snap.data());
      } else {
        console.log("DEBUG: [fetchFeeSettings] admin_settings/fee_settings 문서가 존재하지 않습니다.");
      }
    } catch (err) {
      console.error("❌ 수수료 설정 불러오기 실패:", err);
    }
  };


  useEffect(() => {
    const fetchData = async () => {
      if (status === "loading" || !session?.user?.id) return;

      setLoading(true);
      try {
        const userRef = doc(db, "users", session.user.id);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          setError("사용자 정보를 찾을 수 없습니다.");
          setLoading(false);
          router.push("/role");
          return;
        }
        const userData = userSnap.data() as UserData;
        setCurrentUserRole(userData.role);

        // 컴포넌트 로드 시 판매자라면 계좌번호 자동 가져오기
        // fetchAndSetAccount 함수 내부에 alert 로직이 있으므로, 여기서는 호출만 합니다.
        if (userData.role === "seller") {
          await fetchAndSetAccount();
        }
        await fetchFeeSettings(); // 수수료 설정도 불러오기

        const appRef = doc(db, "applications", id);
        const appSnap = await getDoc(appRef);

        if (!appSnap.exists()) {
          setError("신청서를 찾을 수 없습니다.");
          setLoading(false);
          return;
        }
        const fetchedApplication = { ...appSnap.data(), id: appSnap.id } as Application;
        setApplication(fetchedApplication);
        console.log("DEBUG: [useEffect] Application data fetched:", fetchedApplication); // 추가된 로그

      } catch (err) {
        console.error("Error fetching data:", err);
        setError("데이터를 불러오는 데 실패했습니다.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, session?.user?.id, status, router]);

  // --- 역할 기반 헬퍼 변수 ---
  const isCurrentUserOwner = session?.user?.id === application?.uid;
  const isCurrentUserParticipant = application?.participants.includes(session?.user?.id as string);

  // Determine current status message for all
  const getCurrentTradeStatusMessage = () => {
    if (!application) return "신청서 정보를 불러오는 중입니다."; // Fallback if application is null
    if (application.rejected) return "거래가 거절되었습니다. 고객센터로 문의 주세요."; // 거절 메시지 통일
    
    if (application.settled) {
      if ((isCurrentUserOwner && application.role === "buyer") || (isCurrentUserParticipant && currentUserRole === "buyer")) {
        // 구매자에게만 반환 금액 표시
        console.log("DEBUG: [getCurrentTradeStatusMessage] application.buyerReturnAmount:", application.buyerReturnAmount); 
        return `거래가 완료되었습니다. 신청서 총합에서 고정 수수료를 제외한 ${application.buyerReturnAmount || 0}원이 반환되었습니다.`;
      }
      return "거래가 완료되었습니다."; // 판매자 또는 다른 역할에게는 일반 완료 메시지
    }

    if (!application.approved) {
        return "거래가 아직 승인되지 않았습니다. 관리자의 승인을 기다려주세요.";
    }

    // --- Application is APPROVED from this point ---

    // Scenario 1: Current user is the OWNER of the application
    if (isCurrentUserOwner) {
      if (application.role === "seller") { // Owner is a seller who posted a fish to sell
        if (!application.tradeLink || !application.sellerAccount) {
          return "구매자에게 링크와 계좌번호를 보내주세요.";
        } else if (application.buyerRejectedLink) {
          return "구매자가 확인 불가 상태를 보냈습니다. 거래를 승인하거나 거절해주세요.";
        } else if (application.buyerSettlementClicked && !application.sellerFinalSettlementClicked) {
          return "구매자가 정산 버튼을 눌렀습니다. 입금 확인 후 정산하기 버튼을 눌러주세요.";
        } else if (application.buyerConfirmedLink && !application.buyerSettlementClicked) {
          return "입금이 확인 됐으면 정산하기 버튼을 눌러주세요"; 
        } else {
          return "구매자가 물고기를 확인하고 입금 하는 중 입니다 확인불가하면 이의 하실 수 있으니 물고기 원래 수량, 줄어든 수량 캡쳐해 놓으세요";
        }
      } else if (application.role === "buyer") { // Owner is a buyer who posted a fish to buy
        if (!application.tradeLink || !application.sellerAccount) {
          return "판매자가 링크와 계좌번호를 보내는 것을 기다리고 있습니다.";
        } else if (application.buyerRejectedLink) {
          return "판매자의 승인이나 이의를 기다리는 중입니다 이의가 생기면 고객센터로 연락주셔야 합니다";
        } else if (application.tradeLink && application.sellerAccount && !application.buyerConfirmedLink) {
          return (
            <>
              판매자가 링크를 보냈습니다. 링크를 확인하고 <span className="text-red-500 font-bold">"입금"</span>까지 하신 후 '확인 완료' 또는 '확인 불가'(<span className="text-red-500 font-bold">입금x</span>)를 선택해주세요.
            </>
          );
        } else if (application.buyerConfirmedLink && !application.sellerFinalSettlementClicked) { 
          return "판매자의 최종 정산을 기다리는 중입니다."; 
        } else if (application.sellerFinalSettlementClicked) {
          return "판매자가 최종 정산을 완료했습니다.";
        }
      }
    }
    // Scenario 2: Current user is a PARTICIPANT in the application
    else if (isCurrentUserParticipant) {
      if (application.role === "seller" && currentUserRole === "buyer") { // Buyer participating in seller's app
        if (!application.tradeLink || !application.sellerAccount) {
          return "판매자가 링크와 계좌번호를 보내는 것을 기다리고 있습니다.";
        } else if (application.buyerRejectedLink) {
          return "판매자의 승인이나 이의를 기다리는 중입니다 이의가 생기면 고객센터로 연락주셔야 합니다";
        } else if (application.tradeLink && application.sellerAccount && !application.buyerConfirmedLink) {
          return (
            <>
              판매자가 링크를 보냈습니다. 링크를 확인하고 <span className="text-red-500 font-bold">"입금"</span>까지 하신 후 '확인 완료' 또는 '확인 불가'(<span className="text-red-500 font-bold">입금x</span>)를 선택해주세요.
            </>
          );
        } else if (application.buyerConfirmedLink && !application.sellerFinalSettlementClicked) { 
          return "판매자의 최종 정산을 기다리는 중입니다."; 
        } else if (application.sellerFinalSettlementClicked) {
          return "판매자가 최종 정산을 완료했습니다.";
        }
      } else if (application.role === "buyer" && currentUserRole === "seller") { // Seller participating in buyer's app
        if (!application.tradeLink || !application.sellerAccount) {
          return "구매자에게 링크와 계좌번호를 보내주세요.";
        } else if (application.buyerRejectedLink) {
          return "구매자가 확인 불가 상태를 보냈습니다. 거래를 승인하거나 거절해주세요.";
        } else if (application.buyerSettlementClicked && !application.sellerFinalSettlementClicked) {
          return "구매자가 정산 버튼을 눌렀습니다. 입금 확인 후 정산하기 버튼을 눌러주세요.";
        } else if (application.buyerConfirmedLink && !application.buyerSettlementClicked) {
          return "입금이 확인 됐으면 정산하기 버튼을 눌러주세요"; 
        } else {
          return "구매자가 물고기를 확인하고 입금 하는 중 입니다 확인불가하면 이의 하실 수 있으니 물고기 원래 수량, 줄어든 수량 캡쳐해 놓으세요";
        }
      }
    }
    
    // Fallback for unexpected states or if the user is neither owner nor participant (e.g., third party viewer)
    return "거래 상태를 알 수 없습니다. 이 신청서에 대한 상호작용 권한이 없거나, 다른 역할로 접속했습니다.";
  };


  // --- Seller Actions ---
  const handleSendLinkAndAccount = async () => {
    if (!application || !linkInput || !accountInput) {
      alert("링크와 계좌번호를 모두 입력해주세요.");
      return;
    }
    setLoading(true);
    try {
      const appRef = doc(db, "applications", application.id);
      await updateDoc(appRef, {
        tradeLink: linkInput,
        sellerAccount: accountInput,
      });
      setApplication((prev) => prev ? { ...prev, tradeLink: linkInput, sellerAccount: accountInput } : null);
      alert("링크와 계좌번호가 전송되었습니다.");
    } catch (err) {
      console.error("Error sending link/account:", err);
      alert("링크와 계좌번호 전송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSellerFinalSettlement = async () => {
    if (!application || !session?.user?.id) return;

    setLoading(true);
    try {
      let finalBuyerReturnAmount = 0; // 트랜잭션 외부에서 선언

      await runTransaction(db, async (transaction) => {
        const appRef = doc(db, "applications", application.id);
        const appDoc = await transaction.get(appRef);

        if (!appDoc.exists()) {
          throw "Document does not exist!";
        }

        const currentApp = appDoc.data() as Application;

        if (currentApp.settled || currentApp.rejected) { 
          throw "이미 처리되었거나 거절된 신청서입니다.";
        }

        // ⭐ 변경된 부분: 실제 구매자와 판매자 UID를 신청서 역할에 따라 결정 ⭐
        let actualBuyerUid: string;
        let actualSellerUid: string;

        if (currentApp.role === "buyer") {
            // 신청서 주인이 구매자 (구매자가 신청서를 올림)
            actualBuyerUid = currentApp.uid;
            actualSellerUid = currentApp.participants[0]; // 참여자가 판매자
        } else { // currentApp.role === "seller"
            // 신청서 주인이 판매자 (판매자가 신청서를 올림)
            actualSellerUid = currentApp.uid;
            actualBuyerUid = currentApp.participants[0]; // 참여자가 구매자
        }

        const actualBuyerUserRef = doc(db, "users", actualBuyerUid);
        // 판매자 데이터는 잔액 업데이트가 없으므로 가져올 필요 없음 (참조용으로만 사용)
        // const actualSellerUserRef = doc(db, "users", actualSellerUid); 

        const currentBuyerUserData = (await transaction.get(actualBuyerUserRef)).data() as UserData;
        
        // 판매자 수수료 계산 (기존 로직 유지)
        const sellerFeeRate = 0.05;
        const totalAmount = currentApp.unitPrice * currentApp.quantity; 
        const sellerFee = totalAmount * sellerFeeRate;
        // const amountAfterSellerFee = totalAmount - sellerFee; // 판매자에게 반환하지 않으므로 변수 불필요

        // 구매자에게 반환될 금액 계산
        const fixedFeeKey = currentApp.status; 
        const fixedFeeForBuyerReturn = fees[fixedFeeKey || 'DEFAULT_STATUS_KEY'] || 0; 
        
        console.log("DEBUG: [Seller Settlement] currentApp.status:", currentApp.status);
        console.log("DEBUG: [Seller Settlement] Loaded fees:", fees);
        console.log("DEBUG: [Seller Settlement] fixedFeeKey used:", fixedFeeKey);
        console.log("DEBUG: [Seller Settlement] fixedFeeForBuyerReturn calculated:", fixedFeeForBuyerReturn);
        console.log("DEBUG: [Seller Settlement] currentApp.unitPrice:", currentApp.unitPrice); 
        console.log("DEBUG: [Seller Settlement] currentApp.quantity:", currentApp.quantity); 
        console.log("DEBUG: [Seller Settlement] totalAmount (unitPrice * quantity):", totalAmount); 


        const amountToReturnToBuyer = totalAmount - fixedFeeForBuyerReturn; 
        finalBuyerReturnAmount = Math.max(0, amountToReturnToBuyer); 

        console.log("DEBUG: [Seller Settlement] finalBuyerReturnAmount:", finalBuyerReturnAmount);
        console.log("DEBUG: [Seller Settlement] Actual Buyer UID:", actualBuyerUid); // 추가된 로그
        console.log("DEBUG: [Seller Settlement] Actual Seller UID:", actualSellerUid); // 추가된 로그


        // 1. 신청서 상태 업데이트
        transaction.update(appRef, {
          sellerFinalSettlementClicked: true,
          settled: true,
          closed: true,
          buyerReturnAmount: finalBuyerReturnAmount, 
        });

        // ⭐ 변경된 부분: 판매자 잔액 업데이트 및 거래 기록 제거 ⭐
        // 판매자에게는 금액을 반환하지 않으므로 이 로직을 제거합니다.
        // transaction.update(sellerUserRef, {
        //   balance: currentSellerUserData.balance + amountAfterSellerFee,
        // });
        // transaction.set(doc(collection(db, "transactions")), {
        //   uid: application.uid,
        //   type: "settlement",
        //   amount: amountAfterSellerFee,
        //   timestamp: serverTimestamp(),
        //   description: `판매 정산: ${currentApp.fishName} (${currentApp.quantity}개)`,
        // });


        // 2. 구매자 잔액 업데이트 (반환 금액 추가)
        console.log("DEBUG: [Seller Settlement] Updating actual buyer balance. Old:", currentBuyerUserData.balance, "New:", currentBuyerUserData.balance + finalBuyerReturnAmount); 
        transaction.update(actualBuyerUserRef, { 
          balance: currentBuyerUserData.balance + finalBuyerReturnAmount,
        });
        // 구매자 반환 기록 추가 (0원 이상일 경우만)
        if (finalBuyerReturnAmount > 0) {
          console.log("DEBUG: [Seller Settlement] Adding actual buyer return transaction. Amount:", finalBuyerReturnAmount); 
          transaction.set(doc(collection(db, "transactions")), {
            uid: actualBuyerUid, 
            type: "return",
            amount: finalBuyerReturnAmount,
            timestamp: serverTimestamp(),
            description: `거래 완료 반환: ${currentApp.fishName} (${currentApp.quantity}개) - 수수료 ${fixedFeeForBuyerReturn}원`,
          });
        }

      });

      console.log("DEBUG: [Seller Settlement] Transaction completed successfully."); 
      setApplication((prev) => prev ? { 
        ...prev, 
        sellerFinalSettlementClicked: true, 
        settled: true, 
        closed: true,
        buyerReturnAmount: finalBuyerReturnAmount 
      } : null);
      alert("정산이 완료되었습니다."); // ⭐ 알림 메시지 통일 ⭐
      router.push("/application/mine"); 
    } catch (err: any) {
      console.error("DEBUG: [Seller Settlement] Transaction failed:", err); 
      alert(err.message || "정산 처리 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };


  const handleSellerApprove = async () => {
    if (!application) return;
    setLoading(true);
    try {
      await runTransaction(db, async (transaction) => {
        const appRef = doc(db, "applications", application.id);
        const appDoc = await transaction.get(appRef);

        if (!appDoc.exists()) {
          throw "Application does not exist!";
        }
        const currentApp = appDoc.data() as Application;

        if (currentApp.settled || currentApp.rejected) { 
            throw "이미 처리되었거나 거절된 신청서입니다.";
        }

        transaction.update(appRef, {
          settled: true,
          closed: true,
          rejected: false,
        });
      });

      setApplication((prev) => prev ? { ...prev, settled: true, closed: true, rejected: false } : null);
      alert("거래가 승인되어 종료되었습니다."); 
      router.push("/application/mine");
    } catch (err: any) {
      console.error("Error approving trade:", err);
      alert(err.message || "거래 승인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };


  const handleSellerReject = async () => {
    if (!application) return;
    setLoading(true);
    try {
      const appRef = doc(db, "applications", application.id);
      await updateDoc(appRef, {
        rejected: true,
        closed: true,
        settled: false,
      });
      setApplication((prev) => prev ? { ...prev, rejected: true, closed: true, settled: false } : null);
      alert("거래가 거절되었습니다. 고객센터로 문의 주세요."); 
      router.push("/application/mine");
    } catch (err) {
      console.error("Error rejecting trade:", err);
      alert("거래 거절 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // ⭐ 추가: 판매자 정산 단계에서의 거절 처리 함수 ⭐
  const handleSellerRejectFromSettlement = async () => {
    if (!application) return;
    setLoading(true);
    try {
      const appRef = doc(db, "applications", application.id);
      await updateDoc(appRef, {
        rejected: true,
        closed: true,
        settled: false,
      });
      setApplication((prev) => prev ? { ...prev, rejected: true, closed: true, settled: false } : null);
      alert("거래가 거절되었습니다. 고객센터로 문의 주세요."); 
      router.push("/application/mine");
    } catch (err) {
      console.error("Error rejecting trade from settlement stage:", err);
      alert("거래 거절 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };


  // --- Buyer Actions ---
  const handleBuyerConfirmLink = async () => {
    if (!application) return;
    setLoading(true);
    try {
      const appRef = doc(db, "applications", application.id);
      await updateDoc(appRef, {
        buyerConfirmedLink: true,
        buyerRejectedLink: false,
        buyerSettlementClicked: true, 
      });
      setApplication((prev) => prev ? { 
        ...prev, 
        buyerConfirmedLink: true, 
        buyerRejectedLink: false,
        buyerSettlementClicked: true 
      } : null);
      alert("링크 확인 및 입금 완료가 판매자에게 전송되었습니다. 판매자의 최종 정산을 기다려주세요."); 
    } catch (err) {
      console.error("Error confirming link:", err);
      alert("링크 확인 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleBuyerRejectLink = async () => {
    if (!application) return;
    setLoading(true);
    try {
      const appRef = doc(db, "applications", application.id);
      await updateDoc(appRef, {
        buyerRejectedLink: true,
        buyerConfirmedLink: false,
      });
      setApplication((prev) => prev ? { ...prev, buyerRejectedLink: true, buyerConfirmedLink: false } : null);
      alert("판매자에게 확인 불가 알림이 전송되었습니다.");
    } catch (err) {
      console.error("Error rejecting link:", err);
      alert("확인 불가 알림 전송 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 계좌번호 복사 함수 (구매자가 판매자 계좌번호를 복사할 때 사용될 수 있음)
  const handleCopyAccount = (textToCopy: string) => {
    if (textToCopy) {
      try {
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = textToCopy;
        document.body.appendChild(tempTextArea);
        tempTextArea.select();
        document.execCommand('copy');
        document.body.removeChild(tempTextArea);
        alert("계좌번호가 복사되었습니다!");
      } catch (err) {
        console.error("계좌번호 복사 실패:", err);
        alert("계좌번호 복사에 실패했습니다. 수동으로 복사해주세요.");
      }
    }
  };


  if (loading || status === "loading") {
    return (
      <div className="flex justify-center items-center min-h-screen">
        로딩 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
         오류: {error}
      </div>
    );
  }

  if (!session?.user?.id || !application || !currentUserRole) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        정보를 불러올 수 없습니다.
      </div>
    );
  }


  return (
    <>
      <TabBar />
      <div className="max-w-md mx-auto p-4 pt-8 pb-20 font-sans">
        <h1 className="text-2xl font-bold text-center text-green-600 mb-6">
          물고기 거래 상세 🎣
        </h1>

        <div className="bg-white p-6 rounded-lg shadow-lg mb-6 border border-gray-200">
          <h2 className="text-xl font-bold mb-2 text-gray-800">
            {application.fishName} ({application.status})
          </h2>
          {/* 수량, 오늘/내일 거래, 구매자 닉네임 제거 유지 */}
          <p className="text-gray-700 mb-4">가격: {application.unitPrice}원</p>

          <p className="text-lg font-bold text-center text-blue-600 mt-4 border-t pt-4">
            {getCurrentTradeStatusMessage()}
          </p>
        </div>

        {/* --- 판매자 UI (현재 로그인한 사용자가 '판매자' 역할) --- */}
        {/* 신청서가 판매자가 올린 글이어야 하고, 현재 유저가 판매자 역할이어야 하며, 거래가 종료되지 않았을 때 */}
        {(isCurrentUserOwner && application.role === "seller" && !application.rejected && !application.settled) ||
         (isCurrentUserParticipant && application.role === "buyer" && currentUserRole === "seller" && !application.rejected && !application.settled) ? (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4">
            <h3 className="text-xl font-semibold mb-4 text-pink-500">
              판매자님 진행
            </h3>

            {/* Stage 1: Send Link & Account (only if not already sent) */}
            {!application.tradeLink && !application.sellerAccount && (
              <>
                <div className="mb-4">
                  <label htmlFor="linkInput" className="block text-gray-700 text-sm font-bold mb-2">
                    링크 URL
                  </label>
                  <input
                    id="linkInput"
                    type="text"
                    value={linkInput}
                    onChange={(e) => setLinkInput(e.target.value)}
                    placeholder="링크 URL을 입력해주세요 (예: Google Drive, Imgur)"
                    className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  />
                </div>
                <div className="mb-6">
                  <label htmlFor="accountInput" className="block text-gray-700 text-sm font-bold mb-2">
                    계좌번호
                  </label>
                  <div className="flex items-center gap-2"> {/* flex container for input and button */}
                    <input
                      id="accountInput"
                      type="text"
                      value={accountInput}
                      onChange={(e) => setAccountInput(e.target.value)}
                      placeholder="계좌번호를 입력해주세요"
                      className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline flex-grow"
                    />
                    <button
                      type="button" // Prevent form submission
                      onClick={fetchAndSetAccount} // '가져오기' 버튼 클릭 시 계좌번호 가져오는 함수 호출
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded focus:outline-none focus:shadow-outline text-sm"
                      title="저장된 계좌번호 가져오기"
                    >
                      가져오기
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleSendLinkAndAccount}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline w-full"
                >
                  링크 및 계좌번호 전송
                </button>
              </>
            )}

            {/* Stage 4: Buyer Rejected Link -> Seller Approve/Reject */}
            {application.buyerRejectedLink && !application.sellerFinalSettlementClicked && (
              <div className="mt-4">
                <p className="text-red-600 mb-4 font-semibold text-center">
                  구매자가 확인 불가 상태를 보냈습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleSellerApprove}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex-1"
                  >
                    승인 (거래 종료)
                  </button>
                  <button
                    onClick={handleSellerReject}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex-1"
                  >
                    거절 (고객센터 문의)
                  </button>
                </div>
              </div>
            )}

            {/* Stage 5: Buyer Confirmed Link -> Seller Final Settlement or Reject */}
            {application.buyerConfirmedLink && !application.sellerFinalSettlementClicked && ( 
              <div className="mt-4">
                <p className="text-green-600 mb-4 font-semibold text-center">
                  입금이 확인되었으면 정산 입금확인이 안되었으면 거절버튼을 눌러주세요
                </p>
                <div className="flex gap-2"> {/* 버튼들을 가로로 정렬 */}
                  <button
                    onClick={handleSellerFinalSettlement}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex-1"
                  >
                    정산하기
                  </button>
                  <button
                    onClick={handleSellerRejectFromSettlement} 
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex-1"
                  >
                    거절
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* --- 구매자 UI (현재 로그인한 사용자가 '구매자' 역할) --- */}
        {(isCurrentUserOwner && application.role === "buyer" && !application.rejected && !application.settled) ||
         (isCurrentUserParticipant && application.role === "seller" && currentUserRole === "buyer" && !application.rejected && !application.settled) ? (
          <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4">
            <h3 className="text-xl font-semibold mb-4 text-blue-500">
              구매자님 진행
            </h3>

            {/* Stage 2: Waiting for Seller's Link */}
            {(!application.tradeLink || !application.sellerAccount) && (
              <p className="text-gray-600 text-center">
                판매자가 링크와 계좌번호를 보내는 것을 기다리고 있습니다.
              </p>
            )}

            {/* Stage 3: Link Received - Buyer Confirmation */}
            {application.tradeLink && application.sellerAccount && !application.buyerConfirmedLink && !application.buyerRejectedLink && (
              <>
                <div className="mb-4">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    판매자 링크
                  </label>
                  <a
                    href={application.tradeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline break-all"
                  >
                    {application.tradeLink}
                  </a>
                </div>
                <div className="mb-6">
                  <label className="block text-gray-700 text-sm font-bold mb-2">
                    판매자 계좌번호
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-lg text-gray-800 flex-grow">
                      {application.sellerAccount}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyAccount(application.sellerAccount || '')}
                      className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-3 rounded focus:outline-none focus:shadow-outline text-sm"
                      title="판매자 계좌번호 복사"
                    >
                      복사
                    </button>
                  </div>
                </div>
                <div className="mb-6 flex gap-2">
                  <button
                    onClick={handleBuyerConfirmLink}
                    className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex-1"
                  >
                    확인 완료
                  </button>
                  <button
                    onClick={handleBuyerRejectLink}
                    className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline flex-1"
                  >
                    확인 불가
                  </button>
                </div>
              </>
            )}

            {/* Stage 3.1: Buyer confirmed -> Now waits for seller final settlement */}
            {application.buyerConfirmedLink && !application.sellerFinalSettlementClicked && ( 
                <p className="text-gray-600 text-center">
                    판매자의 최종 정산을 기다리는 중입니다.
                </p>
            )}

          </div>
        ) : null}
        
        {/* --- 최종 상태 (거절 또는 완료) 표시 --- */}
        {(application.rejected || application.settled) && (
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4 text-center">
                <h3 className="text-xl font-semibold mb-4 text-gray-700">거래 상태</h3>
                {application.rejected && (
                    <p className="text-red-600 font-bold text-lg">
                        거래가 거절되었습니다. 고객센터로 문의 주세요.
                    </p>
                )}
                {application.settled && (
                    <p className="text-green-600 font-bold text-lg">
                        거래가 완료되었습니다.
                    </p>
                )}
            </div>
        )}
        
        {/* --- 그 외의 모든 경우 (권한 없음 또는 관련 없음) --- */}
        {/* 현재 사용자가 신청서의 소유자도 아니고, 참여자도 아닌 경우에만 표시 */}
        {!isCurrentUserOwner && !isCurrentUserParticipant && !application.rejected && !application.settled && (
            <div className="bg-white p-6 rounded-lg shadow-lg border border-gray-200 mt-4 text-center">
                <p className="text-gray-600">이 신청서에 대한 상호작용 권한이 없거나, 다른 역할로 접속했습니다.</p>
            </div>
        )}

      </div>
    </>
  );
}
