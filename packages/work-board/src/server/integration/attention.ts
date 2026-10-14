import { RequestReceipt as RequestReceiptSchema } from "#attention/RequestReceipt.ts";
import type { InboxProjection } from "#browser/views/schema.ts";
import { managedRequestReceipt } from "#server/attention/managedRequestReceipt.ts";
import { attentionProjection } from "#server/attention/projection.ts";

export type AttentionProjection = InboxProjection;

export type RequestReceipt = typeof RequestReceiptSchema.Type;

export const attention = {
	managedRequestReceipt,
	projection: attentionProjection,
	RequestReceipt: RequestReceiptSchema,
} as const;
