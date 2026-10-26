import { Clock, Console, Effect } from "effect";
import type { BoardAnswer } from "#host/watchState.ts";

export const watchOutput = Effect.fnUntraced(function* (options: { readonly events: readonly string[]; readonly heartbeatMs?: number }) {
	const startedAt = yield* Clock.currentTimeMillis;
	const seenResponses = new Set<string>();
	let lastOutputAt = startedAt;
	const emit = Effect.fnUntraced(function* (event: { readonly kind: string }) {
		const health = event.kind.startsWith("daemon-") || ["pr-error", "pr-cooldown", "pr-stopped", "heartbeat"].includes(event.kind);
		if (!(options.events.includes(event.kind) || health)) {
			return;
		}
		yield* Console.log(JSON.stringify(event));
		lastOutputAt = yield* Clock.currentTimeMillis;
	});
	return {
		answers: Effect.fnUntraced(function* (answers: readonly (typeof BoardAnswer.Type)[]) {
			for (const answer of answers) {
				if (answer.recordedAt >= startedAt && !seenResponses.has(answer.responseId)) {
					yield* emit(answer);
					seenResponses.add(answer.responseId);
				}
			}
		}),
		emit,
		heartbeat: Effect.gen(function* () {
			if (options.heartbeatMs && (yield* Clock.currentTimeMillis) - lastOutputAt >= options.heartbeatMs) {
				yield* emit({ kind: "heartbeat" });
			}
		}),
	};
});
