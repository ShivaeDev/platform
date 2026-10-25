import { Clock, Effect } from "effect";
import type { WaitReading } from "#browser/responses/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";

export function waitReplies(replies: readonly Effect.Effect<WaitReading, ResponseRejection>[]) {
	let calls = 0;
	const requestedAt: number[] = [];
	const requestedReplies: (typeof replies)[number][] = [];
	return {
		calls: () => calls,
		read: () =>
			Effect.gen(function* () {
				requestedAt.push(yield* Clock.currentTimeMillis);
				const reply = replies[calls];
				calls += 1;
				if (!reply) {
					throw new Error("Unexpected additional await-response RPC call");
				}
				requestedReplies.push(reply);
				return yield* reply;
			}),
		requestedAt: () => [...requestedAt],
		requestedReplies: () => [...requestedReplies],
	};
}
