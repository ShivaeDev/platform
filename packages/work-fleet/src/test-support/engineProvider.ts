import { Effect, Layer } from "effect";
import { type LaunchSettings, SessionFailure, type SessionObservation, type SessionReceipt, type StartSession } from "#session/schema.ts";
import { SessionTransport } from "#session/service.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { reviewerObservation } from "#test/reviewerObservation.ts";

const acceptTurn = Effect.fnUntraced(function* (options: EngineOptions, turns: number) {
	if (turns === 2 && options.continuationGate !== undefined) {
		yield* options.continuationGate;
	}
	if (options.rejectTurn) {
		return yield* Effect.fail(new SessionFailure({ message: "Provider rejected turn before acceptance", reason: "rejected" }));
	}
	if (options.unavailableTurn) {
		return yield* Effect.fail(new SessionFailure({ message: "Provider unavailable after session acknowledgement", reason: "unavailable" }));
	}
});

export function engineProvider(options: EngineOptions, reviews: string[]) {
	const launched: string[] = [];
	const starts: StartSession[] = [];
	const reviewers = new Set<string>();
	let reviewFailed = false;
	let reviewLost = options.lostReviewAcknowledgement ?? false;
	const archived: string[] = [];
	let archiveFailed = false;
	const settings: { readonly call: "session" | "turn"; readonly operationId: string; readonly settings: LaunchSettings | undefined }[] = [];
	const observations = new Map<string, SessionObservation>();
	const failedObservations = new Set<string>();
	const operations = new Map<string, SessionReceipt>();
	let turns = 0;
	let lost = options.lostAcknowledgement ?? false;
	function consumeLostAcknowledgement(readOnly: boolean) {
		const reviewerLost = readOnly && reviewLost;
		const missing =
			lost
			|| reviewerLost
			|| (options.lostContinuationAcknowledgement && turns === 2)
			|| (readOnly && options.lostReviewContinuationAcknowledgement && turns === 3);
		lost = false;
		if (reviewerLost) {
			reviewLost = false;
		}
		return missing;
	}
	const transport = Layer.succeed(SessionTransport)({
		archive: (sessionId) =>
			Effect.gen(function* () {
				if (options.archiveFailure && !archiveFailed) {
					archiveFailed = true;
					return yield* Effect.fail(new SessionFailure({ message: "Archive temporarily unavailable", reason: "unavailable" }));
				}
				archived.push(sessionId);
			}),
		interrupt: (receipt) => Effect.succeed(receipt),
		observe: (receipt) =>
			Effect.gen(function* () {
				if (reviewers.has(receipt.turnId)) {
					yield* options.reviewGate ?? Effect.void;
					if (options.reviewFailure && !reviewFailed) {
						reviewFailed = true;
						return yield* new SessionFailure({ message: "Review observation unavailable", reason: "unavailable" });
					}
				}
				if (failedObservations.delete(receipt.turnId)) {
					return yield* new SessionFailure({ message: "Observation temporarily unavailable", reason: "unavailable" });
				}
				return observations.get(receipt.turnId) ?? { execution: "running" as const, output: "", provisioning: "unknown" as const, receipt };
			}),
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
				starts.push(input);
				settings.push({ call: "session", operationId: input.operationId, settings: input.settings });
				return input.access === "read-only" && options.sameReviewer ? `session-${launched[0]}` : `session-${input.operationId}`;
			}),
		startTurn: (input) =>
			Effect.gen(function* () {
				turns += 1;
				settings.push({ call: "turn", operationId: input.operationId, settings: input.settings });
				yield* acceptTurn(options, turns);
				const receipt = { sessionId: input.sessionId, turnId: `turn-${input.operationId}` };
				operations.set(input.operationId, receipt);
				if (input.access === "read-only") {
					reviewers.add(receipt.turnId);
					observations.set(receipt.turnId, reviewerObservation(options, input.prompt, receipt, reviews));
				} else {
					observations.set(receipt.turnId, { execution: "running", output: input.prompt, provisioning: "ready", receipt });
				}
				if (consumeLostAcknowledgement(input.access === "read-only")) {
					return yield* Effect.fail(new SessionFailure({ message: "Lost acceptance response", reason: "ambiguous" }));
				}
				return receipt;
			}),
	});
	return { archived, failedObservations, launched, observations, operations, settings, starts, transport };
}
export type EngineProvider = ReturnType<typeof engineProvider>;
