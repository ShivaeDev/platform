import { STATUS_CODES } from "node:http";
import { ConfigProvider, Effect } from "effect";
import { FetchHttpClient } from "effect/http";
import { deliverWebhook, type WebhookSigner } from "#server/testing.ts";
import { MAX_BODY_BYTES, PRIVATE_FIELD, sources, WEBHOOK_SECRET } from "#test/fixture.ts";
import type { InboxState } from "#test/host.ts";
import { TIMESTAMPED_SECRET, timestampedHeaders, timestampedSource } from "#test/timestampedSource.ts";

interface DeliveryRequest {
	readonly body?: string;
	readonly delivery?: string | null;
	readonly event?: string | null;
	readonly sign?: WebhookSigner;
	readonly signature?: string | null;
	readonly source?: string;
}

const issueBody = JSON.stringify({ action: "opened", issue: { number: 42 }, private: PRIVATE_FIELD });

const wrongSignature = `sha256=${"0".repeat(64)}`;

export const deliveries = {
	"a delivery over the host's 256-byte limit": { body: "x".repeat(MAX_BODY_BYTES + 1) },
	"a delivery requiring sender opt-in": { body: JSON.stringify({ issue: { number: 42 }, sender: "alice" }), event: "opted_in_issues" },
	"a delivery to an unregistered source": { source: "unknown" },
	"a delivery using a resource": { event: "resource_issues" },
	"a delivery whose mapping fails with a body limit error": { event: "body_limit_failure" },
	"a delivery whose mapping fails with a frozen error": { event: "frozen_failure" },
	"a delivery whose mapping fails with a schema error": { event: "schema_failure" },
	"a delivery whose mapping fails with an unauthorized error": { event: "unauthorized_failure" },
	"a delivery with a stale timestamp": { sign: timestampedHeaders(0), source: "timestamped" },
	"a delivery with a wrong signature": { signature: wrongSignature },
	"a delivery without a delivery ID": { delivery: null },
	"a delivery without a signature": { signature: null },
	"a delivery without an event header": { event: null },
	"a fresh timestamped delivery": { sign: timestampedHeaders(), source: "timestamped" },
	"a non-JSON delivery with a wrong signature": { body: "not-json", signature: wrongSignature },
	"a ping": { body: JSON.stringify({ zen: "Keep it simple" }), event: "ping" },
	"a signed issue 44 delivery with Unicode": { body: JSON.stringify({ action: "opened", issue: { number: 44 }, title: "Hello ☃ café" }) },
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
	return Effect.gen(function* () {
		const response = yield* deliverWebhook({
			body,
			headers: {
				"x-github-delivery": delivered,
				"x-github-event": event,
				...(request.signature === undefined ? {} : { "x-hub-signature-256": request.signature }),
			},
			...(request.sign === undefined ? {} : { sign: request.sign }),
			source: request.source === "timestamped" ? timestampedSource : sources.github,
			url: `${state.url}/hooks/${request.source ?? "github"}`,
		});
		state.sent.push({ body, signature: response.request.headers["x-hub-signature-256"] ?? null });
		const answer = answerOf(response.status, yield* response.text);
		state.answers.push(answer);
		return answer;
	}).pipe(
		Effect.provide(FetchHttpClient.layer),
		Effect.provide(
			ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "TIMESTAMPED_WEBHOOK_SECRET": TIMESTAMPED_SECRET, "WEBHOOK_SECRET": WEBHOOK_SECRET } })),
		),
		Effect.orDie,
	);
}
