// lib/utils/formatApplicationLine.ts

export function formatApplicationLine(app: {
  item?: string;
  status?: string;
  quantity?: number;
  unitPrice?: number;
  priceIfConnected?: number;
}) {
  const item = app.item ?? "-";
  const status = app.status ?? "-";
  const quantity = app.quantity ?? "-";
  const unitPrice = app.unitPrice !== undefined ? `${app.unitPrice.toLocaleString()}원` : "-";
  const priceIfConnected =
    app.priceIfConnected !== undefined ? `${app.priceIfConnected.toLocaleString()}원` : null;

  return `${item} ${status} ${quantity}개 개당 ${unitPrice}${
    status === "미접" && priceIfConnected ? ` (접속시 ${priceIfConnected})` : ""
  }`;
}
