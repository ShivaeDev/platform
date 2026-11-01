import { createHmac } from "node:crypto";
import { STATUS_CODES } from "node:http";
import { Effect } from "effect";
import { MAX_BODY_BYTES, PRIVATE_FIELD, WEBHOOK_SECRET } from "#test/fixture.ts";
import type { InboxState } from "#test/host.ts";

interface DeliveryRequest {
	readonly body?: string;
	readonly delivery?: string | null;
	readonly event?: string | null;
	readonly signature?: string | null;
	readonly source?: string;
}

const issueBody = JSON.stringify({ action: "opened", issue: { number: 42 }, private: PRIVATE_FIELD });

function signature(payload: string) {
	return `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex")}`;
}

export const deliveries = {
	"a delivery over the host's 256-byte limit": { body: "x".repeat(MAX_BODY_BYTES + 1) },
	"a delivery requiring sender opt-in": { body: JSON.stringify({ issue: { number: 42 }, sender: "alice" }), event: "opted_in_issues" },
	"a delivery to an unregistered source": { source: "unknown" },
	"a delivery using a resource": { event: "resource_issues" },
	"a delivery whose mapping fails with a body limit error": { event: "body_limit_failure" },
	"a delivery whose mapping fails with a frozen error": { event: "frozen_failure" },
	"a delivery whose mapping fails with a schema error": { event: "schema_failure" },
	"a delivery whose mapping fails with an unauthorized error": { event: "unauthorized_failure" },
	"a delivery without a delivery ID": { delivery: null },
	"a delivery without a signature": { signature: null },
	"a delivery without an event header": { event: null },
	"a non-JSON delivery signed for another body": { body: "not-json", signature: signature(issueBody) },
	"a ping": { body: JSON.stringify({ zen: "Keep it simple" }), event: "ping" },
	"a signed non-JSON delivery": { body: "not-json" },
	"an issue delivery whose number is a string": { body: JSON.stringify({ action: "opened", issue: { number: PRIVATE_FIELD } }) },
	"an unlisted event whose body is not JSON": { body: "not-json", event: "unlisted" },
	"the signed issue 42 delivery": {},
	"the signed issue 43 delivery using a resource": {
		body: JSON.stringify({ issue: { number: 43 } }),
		delivery: "delivery-2",
		event: "resource_issues",
	},
} satisfies Record<string, DeliveryRequest>;

export type Delivery = keyof typeof deliveries;

function answerOf(status: number, body: string) {
	return `${status} ${STATUS_CODES[status] ?? "Unknown"}${body === "" ? "" : `: ${body}`}`;
}

export function deliver(state: InboxState, delivery: Delivery) {
	const request: DeliveryRequest = deliveries[delivery];
	const body = request.body ?? issueBody;
	const delivered = request.delivery === undefined ? "delivery-1" : request.delivery;
	const event = request.event === undefined ? "issues" : request.event;
	const signed = request.signature === undefined ? signature(body) : request.signature;
	return Effect.tryPromise(async (signal) => {
		state.sent.push({ body, signature: signed });
		const response = await fetch(`${state.url}/hooks/${request.source ?? "github"}`, {
			body,
			headers: {
				...(event === null ? {} : { "x-github-event": event }),
				...(delivered === null ? {} : { "x-github-delivery": delivered }),
				...(signed === null ? {} : { "x-hub-signature-256": signed }),
			},
			method: "POST",
			signal,
		});
		const answer = answerOf(response.status, await response.text());
		state.answers.push(answer);
		return answer;
	}).pipe(Effect.orDie);
}
