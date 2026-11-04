import { Effect, PubSub, Stream } from "effect";
import type { ConfiguredBackend } from "@shivaedev/agent/backend.ts";
import type { RunEvent } from "@shivaedev/agent/events.ts";
import type { EngineState } from "#adapters/initializeEngine.ts";

export function backend(state: EngineState) {
	const configured: ConfiguredBackend = {
		backend: "codex",
		events: (receipt) =>
			Stream.unwrap(
				Effect.gen(function* () {
					const session = state.sessions.get(receipt.session?.value ?? "");
					if (session === undefined) {
						return Stream.empty;
					}
					const subscription = yield* PubSub.subscribe(session.events);
					return Stream.fromIterable<RunEvent>([
						{ receipt, type: "acknowledged" },
						{ reference: session.threadId, type: "session.opened" },
					]).pipe(Stream.concat(Stream.fromSubscription(subscription)), Stream.interruptWhen(state.exited));
				}),
			),
		features: state.features,
		inspect: state.inspect,
		reconcile: state.reconcile,
		start: state.start,
	};
	return Effect.fn("Codex.backend")(() => Effect.succeed(configured));
}
