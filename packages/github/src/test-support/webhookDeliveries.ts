import { EMPTY_SECRET_SIGNATURE, WEBHOOK_SECRET, WORKFLOW_BODY, WRONG_SECRET, webhookSignature } from "#test/appFixture.ts";

export type Delivery =
	| "a signed delivery"
	| "a tampered body"
	| "the wrong secret"
	| "a missing signature header"
	| "a malformed signature header"
	| "an empty secret";
export const deliveries: Record<Delivery, { body: Uint8Array; secret: string; signature: string | undefined }> = {
	"a malformed signature header": { body: WORKFLOW_BODY, secret: WEBHOOK_SECRET, signature: "sha256=abc123" },
	"a missing signature header": { body: WORKFLOW_BODY, secret: WEBHOOK_SECRET, signature: undefined },
	"a signed delivery": { body: WORKFLOW_BODY, secret: WEBHOOK_SECRET, signature: webhookSignature() },
	"a tampered body": { body: Buffer.from('{"action":"requested"}'), secret: WEBHOOK_SECRET, signature: webhookSignature() },
	"an empty secret": { body: WORKFLOW_BODY, secret: "", signature: EMPTY_SECRET_SIGNATURE },
	"the wrong secret": { body: WORKFLOW_BODY, secret: WRONG_SECRET, signature: webhookSignature() },
};
