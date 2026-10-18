import { Effect } from "effect";
import { codexAdapter } from "#providers/codexAdapter.ts";
import { SessionFailure, type StartSession } from "#session/schema.ts";
import { engineScenario } from "#test/engineScenario.ts";

const native = codexAdapter(() => Effect.die("A lost thread has no provider lookup"), {
	beforeTurn: () => Effect.succeed({}),
	provisioning: "unknown",
	threadStart: () => ({}),
});

export function reviewAcknowledgementIsLost(exhausted: boolean) {
	return engineScenario("review acknowledgements are lost within the shared provider budget", () => {
		let now = 100;
		let losses = exhausted ? 4 : 1;
		let reads = 0;
		const retries = losses;
		function loseThread(input: StartSession, sessionId: string) {
			if (input.access !== "read-only") {
				return Effect.succeed(sessionId);
			}
			losses -= 1;
			if (losses < 0) {
				return Effect.succeed(sessionId);
			}
			reads += 1;
			return native.reconcile({ operationId: input.operationId }).pipe(
				Effect.mapError((error) => new SessionFailure({ code: "session-unavailable", message: error.message, reason: error.reason })),
				Effect.flatMap(() => Effect.die("A lost thread cannot be reconciled")),
			);
		}
		return {
			context: {
				loseThread,
				get losses() {
					return losses;
				},
				set losses(value: typeof losses) {
					losses = value;
				},
				get now() {
					return now;
				},
				set now(value: typeof now) {
					now = value;
				},
				get reads() {
					return reads;
				},
				set reads(value: typeof reads) {
					reads = value;
				},
				retries,
			},
			options: {
				decorateTransport: (transport) => ({
					...transport,
					reconcile: (input) => {
						reads += 1;
						return native.reconcile(input);
					},
					startSession: (input) => transport.startSession(input).pipe(Effect.flatMap((sessionId) => loseThread(input, sessionId))),
				}),
				denyDelivery: true,
				now: () => now,
				submissionFailure: (call) =>
					call === "turn" && losses < 0 && exhausted
						? new SessionFailure({ capacity: "serverOverloaded", message: "Provider at capacity", reason: "rejected" })
						: undefined,
			},
		};
	});
}
