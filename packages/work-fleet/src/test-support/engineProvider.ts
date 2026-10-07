import { Effect, Layer } from "effect";
import { SessionFailure, type SessionObservation, type SessionReceipt } from "#session/schema.ts";
import { SessionTransport } from "#session/service.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
export function engineProvider(options: EngineOptions) {
	const launched: string[] = [];
	const observations = new Map<string, SessionObservation>();
	const failedObservations = new Set<string>();
	const operations = new Map<string, SessionReceipt>();
	let lost = options.lostAcknowledgement ?? false;
	const transport = Layer.succeed(SessionTransport)({
		interrupt: (receipt) => Effect.succeed(receipt),
		observe: (receipt) =>
			failedObservations.delete(receipt.turnId)
				? Effect.fail(new SessionFailure({ message: "Observation temporarily unavailable", reason: "unavailable" }))
				: Effect.succeed(
						observations.get(receipt.turnId) ?? { execution: "running" as const, output: "", provisioning: "unknown" as const, receipt },
					),
		reconcile: (input) =>
			Effect.gen(function* () {
				const receipt = operations.get(input.operationId);
				return receipt === undefined
					? yield* Effect.fail(new SessionFailure({ message: "No authoritative operation receipt", reason: "ambiguous" }))
					: receipt;
			}),
		startSession: (input) =>
			Effect.sync(() => {
				launched.push(input.operationId);
				return `session-${input.operationId}`;
			}),
		startTurn: (input) =>
			Effect.gen(function* () {
				if (options.rejectTurn) {
					return yield* Effect.fail(new SessionFailure({ message: "Provider rejected turn before acceptance", reason: "rejected" }));
				}
				const receipt = { sessionId: input.sessionId, turnId: `turn-${input.operationId}` };
				operations.set(input.operationId, receipt);
				observations.set(receipt.turnId, { execution: "running", output: input.prompt, provisioning: "ready", receipt });
				if (lost) {
					lost = false;
					return yield* Effect.fail(new SessionFailure({ message: "Lost acceptance response", reason: "ambiguous" }));
				}
				return receipt;
			}),
	});
	return { failedObservations, launched, observations, operations, transport };
}
export type EngineProvider = ReturnType<typeof engineProvider>;
