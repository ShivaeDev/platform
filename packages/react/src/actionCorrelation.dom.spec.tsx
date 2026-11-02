import { expect } from "vitest";
import { actions, writeClicked, writeScreen } from "#test/action-trace/story.tsx";

for (const mode of ["action", "create", "editor"] as const) {
	actions.it(
		`a click on the ${mode} screen joins its RPC server spans, SQL queries and enqueues in the click's trace`,
		[writeScreen(mode)],
		function* ({ click, traceSpans }) {
			yield* click();

			expect(yield* traceSpans("trace 1")).toEqual({
				enqueues: 2,
				"SQL queries": 2,
				"server RPCs": 2,
				"server RPCs with a request id and a parent": 2,
			});
		},
		20_000,
	);

	actions.it(
		`each click on the ${mode} screen sends its own trace in every RPC it makes`,
		[writeClicked(mode)],
		function* ({ click, rpcTraces }) {
			expect(yield* rpcTraces()).toEqual(["trace 1", "trace 1"]);

			yield* click();

			expect(yield* rpcTraces()).toEqual(["trace 1", "trace 1", "trace 2", "trace 2"]);
		},
		20_000,
	);

	actions.it(
		`a worker attempt for a job from the ${mode} screen runs in its own trace linked to the enqueue span`,
		[writeClicked(mode)],
		function* ({ workerAttempts, workerRuns }) {
			expect(yield* workerAttempts()).toEqual([
				{ enqueue: 1, trace: "trace 1", workers: [] },
				{ enqueue: 2, trace: "trace 1", workers: [] },
			]);

			yield* workerRuns();

			expect(yield* workerAttempts()).toEqual([
				{ enqueue: 1, trace: "trace 1", workers: ["another trace"] },
				{ enqueue: 2, trace: "trace 1", workers: ["another trace"] },
			]);
		},
		20_000,
	);
}
