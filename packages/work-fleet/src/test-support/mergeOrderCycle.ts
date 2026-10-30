import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";

export const mergeOrderCycle = engineConfiguration("PRs have cyclic merge orders, failed checks and no requested repair", () => ({
	backlog: 4,
	checksQuery: (result) => Effect.succeed({ evidence: ["Required check failed"], head: result.head, passed: false }),
	concurrency: 4,
	denyDelivery: true,
	predict: (pr) => {
		const id = pr.split("/").at(-1) ?? "";
		return Effect.succeed({
			conflicts: [
				{
					files: ["shared.ts"],
					head: `head-${id}-0`,
					observedAt: "2026-01-01T00:00:00Z",
					otherHead: `head-${id === "one" ? "two" : "one"}-0`,
					otherPr: `https://example.invalid/pr/${id === "one" ? "two" : "one"}`,
					wait: true,
				},
			],
			head: `head-${id}-0`,
			mainRevision: "main",
			mergedPrs: [],
			observedAt: "2026-01-01T00:00:00Z",
		});
	},
}));
