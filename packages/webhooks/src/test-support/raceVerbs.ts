import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { raceWithLock } from "@shivaedev/test-sql/server/raceWithLock.ts";
import type { InboxState } from "#test/host.ts";
import { deliver } from "#test/requests.ts";

const RACE_LOCK = 4242;

// The lock holds the first copy at its receipt update, so the second copy is proven to wait on the first copy's uncommitted receipt.
function holdReceiptUpdates(failFirst: boolean) {
	const failure = failFirst ? "if nextval('webhook_story_receipt_updates') = 1 then raise exception 'the first receipt update fails'; end if;" : "";
	return Effect.gen(function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create sequence webhook_story_receipt_updates`;
		yield* sql.unsafe(`create function webhook_story_race() returns trigger language plpgsql as $$
			begin perform pg_advisory_xact_lock(${RACE_LOCK}); ${failure} return new; end $$`);
		yield* sql`create trigger webhook_story_race before update on webhook_receipts for each row execute function webhook_story_race()`;
	});
}

export function raceVerbs(state: InboxState, tell: (line: string) => void) {
	return {
		deliverTwoCopiesTogether: () =>
			Effect.gen(function* () {
				tell("github sends two copies of the signed issue 42 delivery at once, and the second waits on the first copy's receipt");
				yield* holdReceiptUpdates(state.firstReceiptUpdateFails);
				const sql = yield* SqlClient.SqlClient;
				yield* raceWithLock({
					effects: [deliver(state, "the signed issue 42 delivery"), deliver(state, "the signed issue 42 delivery")],
					lock: sql`select pg_advisory_xact_lock(${RACE_LOCK})`,
				});
			}),
	};
}
