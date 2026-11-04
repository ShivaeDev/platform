import { Effect } from "effect";
import { inspection } from "#server/adapters/inspection.ts";
import { PgBoss } from "#server/PgBoss.ts";

export const initializeInspection = Effect.gen(function* () {
	const acquired = yield* PgBoss;
	return yield* inspection(acquired.client, acquired.schema);
});
