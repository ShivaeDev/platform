import { parallelApps } from "#test-support/parallelApps.ts";

parallelApps.it(
	"drops full-app story databases cleanly with four parallel Vitest workers",
	[],
	function* ({ runWorkers }) {
		yield* runWorkers();
	},
	60_000,
);
