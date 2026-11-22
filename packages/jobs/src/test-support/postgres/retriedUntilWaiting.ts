import { database } from "#test/postgres/database.ts";
import { driveWorkers } from "#test/postgres/driveWorkers.ts";
import { waitingVerbs } from "#test/postgres/waitingVerbs.ts";

// A retry is fetched on a later poll, so the workers are woken until the retried job reaches its gate.
export function retriedUntilWaiting(gate: string, line: string) {
	return database.trait("jobs", line, (engine) => driveWorkers(engine, waitingVerbs(engine, () => undefined).untilWaiting(gate)));
}
