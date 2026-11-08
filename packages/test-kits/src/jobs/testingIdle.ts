import { Effect } from "effect";
import type { PgBossInspectionService } from "@shivaedev/jobs/server/inspection.ts";
import type { PgBossTestingError } from "#jobs/error.ts";
import { testingInspection } from "#jobs/testingInspection.ts";

export interface TestingBatch {
	readonly jobs: ReadonlyMap<string, number>;
	readonly name: string;
	settled: boolean;
}

export interface TestingWork {
	readonly batches: Set<TestingBatch>;
	readonly queues: Set<string>;
}

export function testingIdle(
	inspection: () => PgBossInspectionService,
	work: TestingWork,
	signal: { readonly revision: Effect.Effect<number>; readonly waitForChange: (after: number) => Effect.Effect<number> },
	wake: Effect.Effect<void> = Effect.void,
): Effect.Effect<void, PgBossTestingError> {
	const busy = Effect.suspend(() => testingInspection("waitForIdle", inspection().busy([...work.queues].map((name) => ({ name })))));
	return Effect.gen(function* () {
		while (true) {
			const revision = yield* signal.revision;
			// A batch with no settlement since its fetch still holds active jobs, so it is busy without a read.
			const unsettled = [...work.batches].some((batch) => !batch.settled);
			if (work.queues.size === 0 || !(unsettled || (yield* busy))) {
				return;
			}
			yield* wake;
			yield* signal.waitForChange(revision);
		}
	});
}
