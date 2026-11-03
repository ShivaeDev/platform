import type { JobTiming } from "#ci/adapters/jobTiming.ts";

export const staleJobTiming: typeof JobTiming.Type = {
	completedAt: null,
	conclusion: null,
	name: "tests (1)",
	startedAt: "2026-01-01T00:00:00Z",
	steps: [
		{ completedAt: "2026-01-01T00:04:50Z", conclusion: "success", name: "Test workspace shard", status: "completed" },
		{ completedAt: "2026-01-01T00:04:59Z", conclusion: "skipped", name: "Optional timing fallback", status: "completed" },
		{ completedAt: "2026-01-01T00:05:00Z", conclusion: "success", name: "Complete job", status: "completed" },
	],
};
