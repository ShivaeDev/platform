import { Effect, Schedule } from "effect";
import type { PrismaClient } from "#test/generated/client.ts";

export function committing(observer: PrismaClient, pid: number) {
	return Effect.promise(() =>
		observer.$queryRawUnsafe<ReadonlyArray<{ state: string | null; query: string }>>(`select state, query from pg_stat_activity where pid = ${pid}`),
	).pipe(
		Effect.flatMap((rows) => (rows.some((row) => row.state === "active" && row.query === "COMMIT") ? Effect.void : Effect.fail("not committing"))),
		Effect.retry({ schedule: Schedule.spaced("5 millis"), times: 2000 }),
	);
}
