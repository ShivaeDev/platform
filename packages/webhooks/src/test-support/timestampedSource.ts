import { Clock, Config, Effect } from "effect";
import { githubHeaders } from "#server/adapters/githubHeaders.ts";
import { githubStrategy } from "#server/github.ts";
import type { WebhookSigner } from "#server/testing.ts";
import { WebhookUnauthorized } from "#server/WebhookUnauthorized.ts";
import { sources } from "#test/fixture.ts";

export const TIMESTAMPED_SECRET = "timestamped-story-signing-secret";

export function timestampedHeaders(at?: number): WebhookSigner {
	return (body, key) =>
		Effect.gen(function* () {
			const timestamp = String(at ?? Math.floor((yield* Clock.currentTimeMillis) / 1000));
			return { ...(yield* githubHeaders(`${timestamp}.${body}`, key)), "x-webhook-timestamp": timestamp };
		});
}

export const timestampedSource = {
	...sources.github,
	key: Config.Redacted("TIMESTAMPED_WEBHOOK_SECRET"),
	strategy: {
		delivery: githubStrategy.delivery,
		verify: Effect.fnUntraced(function* (body, headers, key) {
			const timestamp = headers["x-webhook-timestamp"];
			yield* githubStrategy.verify(new TextEncoder().encode(`${timestamp}.${new TextDecoder().decode(body)}`), headers, key);
			const now = Math.floor((yield* Clock.currentTimeMillis) / 1000);
			if (timestamp === undefined || Math.abs(now - Number(timestamp)) > 300) {
				yield* new WebhookUnauthorized();
			}
		}),
	} satisfies typeof githubStrategy,
};
