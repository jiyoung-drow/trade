// lib/utils/formatApplicationLine.ts
export const formatApplicationLine = (application: any) => {
  const { item, quantity, unitPrice, tradeStatus, participantId } = application;
  return `${item} | 수량: ${quantity} | 단가: ${unitPrice}원 | 상태: ${tradeStatus} | 참여자: ${participantId ?? '없음'}`;
};

