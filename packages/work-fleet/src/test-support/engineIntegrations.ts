import { Effect, Layer } from "effect";
import { ServiceUnavailable } from "@shivaedev/effect-contract/errors/taxonomy.ts";
import { type BoardWork, type Checks, FleetIntegrations, type WorkResult } from "#policy.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { mainObservation } from "#test/preparation.ts";
export function engineIntegrations(options: EngineOptions, merged: string[]) {
	const green = new Set<string>();
	return Layer.effect(FleetIntegrations)(
		Effect.gen(function* () {
			const results = new Map<string, WorkResult>();
			const counts = new Map<string, number>();
			let checksFailed = false;
			let deliveryFailed = false;
			const checkResult = Effect.fnUntraced(function* (result: WorkResult, purpose?: "review") {
				const checks: Checks = yield* options.checksQuery?.(result)
					?? Effect.gen(function* () {
						if (purpose !== "review" && options.checksGate !== undefined) {
							yield* options.checksGate;
						}
						const passed = !(options.checksFailure && !checksFailed);
						checksFailed ||= purpose !== "review";
						return {
							evidence: ["Required test and build checks passed"],
							head: options.wrongHead === "checks" ? "wrong-head" : result.head,
							passed,
							...(options.checkRepair ? { repairPrompt: "Fix the failed required check" } : {}),
						};
					});
				if (purpose !== "review" && passedChecks(checks, result.head)) {
					green.add(result.head);
				}
				return checks;
			});
			return {
				...(options.predict === undefined ? {} : { predict: options.predict }),
				...(options.publicationQuery === undefined ? {} : { publication: options.publicationQuery }),
				checks: (_board, result, purpose) => checkResult(result, purpose),
				delivery: (result) =>
					options.deliveryQuery?.(result)
					?? Effect.gen(function* () {
						if (options.denyDelivery || !green.has(result.head)) {
							return undefined;
						}
						if (options.deliveryFailure && !deliveryFailed) {
							deliveryFailed = true;
							return yield* Effect.fail(new ServiceUnavailable({ message: "Delivery observation unavailable" }));
						}
						if (!merged.includes(result.head)) {
							merged.push(result.head);
						}
						return { head: result.head, revision: `merged-${result.head}`, url: result.pr };
					}),
				main: (preparation) =>
					options.mainQuery?.(preparation)
					?? Effect.succeed(mainObservation({ changedPaths: options.mainChanges ?? [], fromRevision: preparation.baseRevision })),
				result: (board, observation) => {
					if (options.resultQuery !== undefined) {
						return options.resultQuery(board, observation);
					}
					if (options.resultUnavailable) {
						return Effect.fail(new ServiceUnavailable({ message: "Result ownership unavailable" }));
					}
					let result = results.get(observation.receipt.turnId);
					if (result === undefined) {
						const count = counts.get(board.workId) ?? 0;
						result = fixtureResult(options, board, count);
						counts.set(board.workId, count + 1);
						results.set(observation.receipt.turnId, result);
					}
					return Effect.succeed(result);
				},
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

function passedChecks(checks: Checks, head: string) {
	return checks.passed && !checks.pending && checks.head === head;
}
