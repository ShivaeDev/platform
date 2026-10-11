import type { Effect } from "effect";
import type { WaitReading } from "#browser/responses/schema.ts";
import type { ResponseRejection } from "#rpc/rejections.ts";

export function waitReplies(replies: readonly Effect.Effect<WaitReading, ResponseRejection>[]) {
	let calls = 0;
	return {
		calls: () => calls,
		read: () => {
			const reply = replies[calls];
			calls += 1;
			if (!reply) {
				throw new Error("Unexpected additional await-response RPC call");
			}
			return reply;
		},
	};
}
