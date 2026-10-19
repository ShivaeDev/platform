import { Effect, Schema } from "effect";
import type { PgBoss } from "pg-boss";
import type { PgBossTestingError } from "#error.ts";
import { quotedSchema } from "#internal/storedRows.ts";
import { testingOperation } from "#internal/testingReadout.ts";

export interface TestingBatch {
	readonly name: string;
	settled: boolean;
}

export interface TestingWork {
	readonly batches: Set<TestingBatch>;
	readonly queues: Set<string>;
}

const Busy = Schema.Struct({ busy: Schema.Boolean });

export function testingIdle(
	client: () => PgBoss,
	schema: () => string,
	work: TestingWork,
	signal: { readonly revision: Effect.Effect<number>; readonly waitForChange: (after: number) => Effect.Effect<number> },
): Effect.Effect<void, PgBossTestingError> {
	const busy = testingOperation("waitForIdle", async () => {
		const quoted = quotedSchema(schema());
		const { rows } = await client()
			.getDb()
			.executeSql(
				`/* effect-pg-boss testing idle */ SELECT EXISTS (
					SELECT 1 FROM ${quoted}.job
					WHERE name = ANY($1::text[]) AND (
						(state < 'active' AND NOT blocked AND start_after <= ${quoted}.job_now())
						OR state = 'active'
					)
				) AS busy`,
				[[...work.queues]],
			);
		return (await Schema.decodeUnknownPromise(Busy)(rows[0])).busy;
	});
	return Effect.gen(function* () {
		while (true) {
			const revision = yield* signal.revision;
			// A batch with no settlement since its fetch still holds active jobs, so it is busy without a read.
			const unsettled = [...work.batches].some((batch) => !batch.settled);
			if (work.queues.size === 0 || !(unsettled || (yield* busy))) {
				return;
			}
			yield* signal.waitForChange(revision);
		}
	});
}
