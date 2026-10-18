import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { engineScenario } from "#test/engineScenario.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };

export function deliveryReadsCanFail(state: "CLOSED" | "OPEN") {
	return engineScenario("delivery reads can fail after a Board decision", () => {
		let unavailable = false;
		let observation: unknown = { ...open, state };
		const deliveryQuery = githubDelivery(() =>
			unavailable ? Effect.fail(new ServiceUnavailable({ message: "GitHub request failed" })) : Effect.succeed(observation),
		);
		return {
			context: {
				deliveryQuery,
				get observation() {
					return observation;
				},
				set observation(value: typeof observation) {
					observation = value;
				},
				get unavailable() {
					return unavailable;
				},
				set unavailable(value: typeof unavailable) {
					unavailable = value;
				},
			},
			options: { deliveryQuery, resultQuery: () => Effect.succeed(result) },
		};
	});
}
export function movedHeadReadCanFail() {
	return engineScenario("a moved-head refresh can fail without replacing the decision", () => {
		let unavailable = false;
		let observation: unknown = open;
		const deliveryQuery = githubDelivery(() => Effect.succeed(observation));
		return {
			context: {
				deliveryQuery,
				get observation() {
					return observation;
				},
				set observation(value: typeof observation) {
					observation = value;
				},
				get unavailable() {
					return unavailable;
				},
				set unavailable(value: typeof unavailable) {
					unavailable = value;
				},
			},
			options: {
				deliveryQuery,
				resultQuery: () => (unavailable ? Effect.fail(new ServiceUnavailable({ message: "GitHub result read failed" })) : Effect.succeed(result)),
			},
		};
	});
}
