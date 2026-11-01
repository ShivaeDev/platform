import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { queryHeadersStory, watching } from "#test/queryHeadersStory.ts";

for (const delivery of ["hints", "pushed"] as const) {
	queryHeadersStory.it(
		`${delivery}: subscriptions and reruns keep each query's own headers`,
		[watching(delivery)],
		function* ({ edit, reads, shown, subscriptions }) {
			yield* outcomes([
				["query values", () => shown(), ["alice: First", "bob: First", "default: First"]],
				["subscription headers", () => subscriptions(), ["alice", "bob", "default"]],
				["read headers", () => reads(), ["alice", "bob", "default"]],
			]);

			yield* edit("Second");

			yield* outcomes([
				["query values", () => shown(), ["alice: Second", "bob: Second", "default: Second"]],
				["read headers", () => reads(), ["alice", "bob", "default"]],
			]);
		},
	);
}
