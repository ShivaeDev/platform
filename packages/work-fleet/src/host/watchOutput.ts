import { Clock, Console, Effect } from "effect";
import { type WatchLine, watchAttention } from "#host/watchAttention.ts";
import type { BoardAnswer } from "#host/watchState.ts";

export const watchOutput = Effect.fnUntraced(function* (options: {
	readonly all?: boolean;
	readonly events: readonly string[];
	readonly heartbeatMs?: number;
	readonly json?: boolean;
}) {
	const startedAt = yield* Clock.currentTimeMillis;
	const seenResponses = new Set<string>();
	const attention = watchAttention();
	let lastOutputAt = startedAt;
	const write = Effect.fnUntraced(function* (event: { readonly kind: string }) {
		yield* Console.log(
			options.json
				? JSON.stringify(event)
				: [
						event.kind,
						...Object.entries(event)
							.filter(([key, value]) => key !== "kind" && value !== undefined)
							.map(([key, value]) => `${key}=${JSON.stringify(value)}`),
					].join(" "),
		);
		lastOutputAt = yield* Clock.currentTimeMillis;
	});
	const emit = Effect.fnUntraced(function* (event: WatchLine) {
		const health = event.kind.startsWith("daemon-") || ["pr-error", "pr-cooldown", "pr-stopped", "heartbeat"].includes(event.kind);
		if (!(options.events.includes(event.kind) || health)) {
			return;
		}
		if (!(options.all || (yield* attention.accept(event)))) {
			return;
		}
		const { retryable: _retryable, ...printed } = event;
		yield* write(printed);
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
			const now = yield* Clock.currentTimeMillis;
			if (yield* attention.outage) {
				yield* write({ kind: "daemon-unreachable" });
			}
			if (options.heartbeatMs && now - lastOutputAt >= options.heartbeatMs) {
				yield* emit({ kind: "heartbeat" });
			}
		}),
	};
});
