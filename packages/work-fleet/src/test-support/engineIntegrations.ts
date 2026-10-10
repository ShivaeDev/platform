import { Effect, Layer } from "effect";
import type { Review } from "#policy.ts";
import { type BoardWork, FleetFailure, FleetIntegrations, type WorkResult } from "#policy.ts";
import type { SessionObservation, SessionReceipt } from "#session/schema.ts";
import { SessionService } from "#session/service.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineProvider } from "#test/engineProvider.ts";
import { mainObservation } from "#test/preparation.ts";
export function engineIntegrations(options: EngineOptions, provider: EngineProvider, reviews: string[], merged: string[]) {
	return Layer.effect(FleetIntegrations)(
		Effect.gen(function* () {
			const sessions = yield* SessionService;
			let repaired = false;
			let failed = false;
			let checksFailed = false;
			let deliveryFailed = false;
			function review(board: BoardWork, result: WorkResult, operationId: string, resume: boolean) {
				return Effect.gen(function* () {
					const receipt = yield* resume
						? sessions.reconcile({ operationId })
						: sessions.start({ cwd: "/synthetic", operationId, prompt: "Independent review" });
					if (options.reviewFailure && !failed) {
						failed = true;
						return yield* Effect.fail(new FleetFailure({ message: "Review response lost", reason: "integration" }));
					}
					if (options.reviewGate !== undefined) {
						yield* options.reviewGate;
					}
					reviews.push(result.head);
					const changes = options.repairs === true && !repaired;
					repaired = true;
					provider.observations.set(receipt.turnId, reviewObservation(options, receipt));
					return reviewEvidence(options, board, result, receipt, provider, changes);
				}).pipe(Effect.mapError(() => new FleetFailure({ message: "Independent review unavailable", reason: "integration" })));
			}
			return {
				authorize: () => Effect.succeed(!options.denyDelivery),
				checks: (_board, result) =>
					Effect.gen(function* () {
						if (options.checksGate !== undefined) {
							yield* options.checksGate;
						}
						const passed = !(options.checksFailure && !checksFailed);
						checksFailed = true;
						return {
							evidence: ["Required test and build checks passed"],
							head: options.wrongHead === "checks" ? "wrong-head" : result.head,
							passed,
							...(options.checkRepair ? { repairPrompt: "Fix the failed required check" } : {}),
						};
					}),
				delivery: (result) =>
					Effect.succeed(merged.includes(result.head) ? { head: result.head, revision: `merged-${result.head}`, url: result.pr } : undefined),
				main: (preparation) => Effect.succeed(mainObservation({ changedPaths: options.mainChanges ?? [], fromRevision: preparation.baseRevision })),
				merge: (_board, result) =>
					Effect.gen(function* () {
						merged.push(result.head);
						if (options.deliveryFailure && !deliveryFailed) {
							deliveryFailed = true;
							return yield* Effect.fail(new FleetFailure({ message: "Delivery acknowledgement lost", reason: "integration" }));
						}
						return { head: result.head, revision: `merged-${result.head}`, url: result.pr };
					}),
				reconcileReview: (board, result, operationId) => review(board, result, operationId, true),
				result: (board) =>
					options.resultQuery?.()
					?? (options.resultUnavailable
						? Effect.fail(new FleetFailure({ message: "Result ownership unavailable", reason: "integration" }))
						: Effect.succeed(fixtureResult(options, board, reviews.length))),
				review: (board, result, operationId) => review(board, result, operationId, false),
			};
		}),
	);
}
function fixtureResult(options: EngineOptions, board: BoardWork, count: number): WorkResult {
	if (options.noChange) {
		return { evidence: ["Existing behavior meets acceptance criteria"], head: "current-main", kind: "no-change" };
	}
	return {
		head: `head-${board.workId}-${count}`,
		kind: "change",
		paths: [`src/${board.workId}.ts`],
		pr: `https://example.invalid/pr/${board.workId}`,
	};
}

function reviewObservation(options: EngineOptions, receipt: SessionReceipt): SessionObservation {
	return { execution: options.reviewRunning ? "running" : "completed", output: "Review evidence", provisioning: "ready", receipt };
}
function reviewEvidence(
	options: EngineOptions,
	board: BoardWork,
	result: WorkResult,
	receipt: SessionReceipt,
	provider: EngineProvider,
	changes: boolean,
): Review {
	const first = provider.operations.values().next().value;
	return {
		evidence: ["Independent code review"],
		head: options.wrongHead === "review" ? "wrong-head" : result.head,
		receipt: options.sameReviewer && first !== undefined ? first : receipt,
		repairPrompt: `Repair ${board.workId}`,
		verdict: changes ? "changes" : "approved",
	};
}
