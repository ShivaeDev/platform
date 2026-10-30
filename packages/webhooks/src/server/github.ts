import { Effect } from "effect";
import { verifyWebhook } from "@shivaedev/github/verifyWebhook.ts";
import type { WebhookSource, WebhookStrategy } from "#server/registration.ts";
import { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";

export const githubStrategy: WebhookStrategy = {
	delivery: (headers) => ({ event: headers["x-github-event"], id: headers["x-github-delivery"] }),
	verify: (body, headers, key) => verifyWebhook(body, headers["x-hub-signature-256"], key).pipe(Effect.mapError(() => new WebhookUnauthorized())),
};

export function githubSource<R>(options: Omit<WebhookSource<R>, "strategy">): WebhookSource<R> {
	return { ...options, strategy: githubStrategy };
}
