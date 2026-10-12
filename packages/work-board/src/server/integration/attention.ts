import { RequestReceipt as RequestReceiptSchema } from "#attention/RequestReceipt.ts";
import { managedRequestReceipt } from "#server/attention/managedRequestReceipt.ts";

export type RequestReceipt = typeof RequestReceiptSchema.Type;

export const attention = {
	managedRequestReceipt,
	RequestReceipt: RequestReceiptSchema,
} as const;
