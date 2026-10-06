import { Effect, Layer } from "effect";
import { SessionFailure } from "#session/schema.ts";
import { SessionJournal, SessionService, SessionTransport } from "#session/service.ts";
export const receipt = { sessionId: "synthetic-session", turnId: "synthetic-turn" };
export function sessionHarness(
	events: string[],
	options: {
		lostTurn?: boolean;
		brokenJournal?: boolean;
		differentReceipt?: boolean;
		interruptFailure?: boolean;
	} = {},
) {
	const returned = options.differentReceipt ? { sessionId: "foreign-session", turnId: "foreign-turn" } : receipt;
	const transport = Layer.succeed(SessionTransport)({
		interrupt: (interrupted) =>
			Effect.gen(function* () {
				if (options.interruptFailure) {
					return yield* Effect.fail(new SessionFailure({ message: "No interruption acknowledgement", reason: "ambiguous" }));
				}
				events.push("explicit interruption acknowledged");
				return options.differentReceipt ? returned : interrupted;
			}),
		observe: (observed) =>
			Effect.succeed({ execution: "accepted", output: "", provisioning: "unknown", receipt: options.differentReceipt ? returned : observed }),
		reconcile: () =>
			Effect.sync(() => {
				events.push("existing operation reconciled");
				return returned;
			}),
		startSession: () =>
			Effect.sync(() => {
				events.push("session acknowledged");
				return receipt.sessionId;
			}),
		startTurn: (input) =>
			Effect.gen(function* () {
				events.push(`turn submitted:${input.sessionId}`);
				if (options.lostTurn) {
					return yield* Effect.fail(new SessionFailure({ message: "lost reply", reason: "ambiguous" }));
				}
				return returned;
			}),
	});
	const journal = Layer.succeed(SessionJournal)({
		acknowledgeSession: () =>
			Effect.gen(function* () {
				events.push("session persisted");
				if (options.brokenJournal) {
					return yield* Effect.fail(new SessionFailure({ message: "unavailable", reason: "persistence" }));
				}
			}),
		acknowledgeTurn: () =>
			Effect.sync(() => {
				events.push("turn persisted");
			}),
	});
	return SessionService.layer.pipe(Layer.provide(Layer.merge(transport, journal)));
}
