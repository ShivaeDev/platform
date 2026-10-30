import { Effect } from "effect";
import { verifyWebhook } from "@shivaedev/github/verifyWebhook.ts";
import type { WebhookEvent, WebhookSource, WebhookStrategy } from "#server/registration.ts";
import { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";

export const githubStrategy: WebhookStrategy = {
	delivery: (headers) => ({ event: headers["x-github-event"], id: headers["x-github-delivery"] }),
	verify: (body, headers, key) => verifyWebhook(body, headers["x-hub-signature-256"], key).pipe(Effect.mapError(() => new WebhookUnauthorized())),
};

type EventEffect<TEvents extends Readonly<Record<string, WebhookEvent<unknown, unknown>>>> = ReturnType<TEvents[keyof TEvents]["decode"]>;

export function githubSource<R, E = never>(options: Omit<WebhookSource<R, E>, "strategy">): WebhookSource<R, E>;
export function githubSource<const TEvents extends Readonly<Record<string, WebhookEvent<unknown, unknown>>>>(options: {
	readonly events: TEvents;
	readonly key: WebhookSource["key"];
}): WebhookSource<Effect.Services<EventEffect<TEvents>>, Effect.Error<EventEffect<TEvents>>>;
export function githubSource<R, E = never>(options: Omit<WebhookSource<R, E>, "strategy">): WebhookSource<R, E> {
	return { ...options, strategy: githubStrategy };
}
