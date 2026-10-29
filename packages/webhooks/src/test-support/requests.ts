import { createHmac } from "node:crypto";
import { Effect } from "effect";
import { body, WEBHOOK_SECRET } from "#test/fixture.ts";
import type { InboxState } from "#test/host.ts";

export interface DeliveryOptions {
	readonly body?: string;
	readonly delivery?: string | null;
	readonly event?: string | null;
	readonly signature?: string | null;
	readonly source?: string;
}

export function signature(payload: string) {
	return `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex")}`;
}

export function deliver(state: InboxState, options: DeliveryOptions = {}) {
	return Effect.tryPromise(async () => {
		const payload = options.body ?? body;
		const delivery = options.delivery === undefined ? "delivery-1" : options.delivery;
		const event = options.event === undefined ? "issues" : options.event;
		const signed = options.signature === undefined ? signature(payload) : options.signature;
		const response = await fetch(`${state.url}/hooks/${options.source ?? "github"}`, {
			body: payload,
			headers: {
				...(event === null ? {} : { "x-github-event": event }),
				...(delivery === null ? {} : { "x-github-delivery": delivery }),
				...(signed === null ? {} : { "x-hub-signature-256": signed }),
			},
			method: "POST",
		});
		return { body: await response.text(), status: response.status };
	});
}
