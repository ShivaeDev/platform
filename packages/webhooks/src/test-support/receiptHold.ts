import { Deferred, Effect, Fiber, Schedule } from "effect";
import { SqlClient } from "effect/sql";

const HOLD = 4242;

const waitingCopies = SqlClient.SqlClient.use(
	(sql) =>
		sql<{ readonly pid: number; readonly waitEvent: string }>`select pid, wait_event as "waitEvent" from pg_stat_activity
			where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid() order by wait_event`.withoutTransform,
);

export function receiptHold() {
	let release: Effect.Effect<void, unknown> | undefined;
	return {
		cancelCopyWaitingOnHold: () =>
			Effect.gen(function* () {
				const held = (yield* waitingCopies).filter(({ waitEvent }) => waitEvent === "advisory");
				if (held.length !== 1) {
					return yield* Effect.die(new Error(`Expected one copy waiting on the receipt hold, found ${held.length}`));
				}
				const sql = yield* SqlClient.SqlClient;
				yield* sql`select pg_cancel_backend(${held[0]?.pid})`;
			}),
		holdReceiptUpdates: () =>
			Effect.gen(function* () {
				const sql = yield* SqlClient.SqlClient;
				yield* sql`create function webhook_story_hold() returns trigger language plpgsql as $$
					begin perform pg_advisory_xact_lock(${sql.literal(String(HOLD))}); return new; end $$`;
				yield* sql`create trigger webhook_story_hold before update on webhook_receipts for each row execute function webhook_story_hold()`;
				const held = yield* Deferred.make<void>();
				const released = yield* Deferred.make<void>();
				const holder = yield* sql
					.withTransaction(
						sql`select pg_advisory_xact_lock(${HOLD})`.pipe(
							Effect.andThen(Deferred.succeed(held, undefined)),
							Effect.andThen(Deferred.await(released)),
						),
					)
					.pipe(Effect.forkScoped);
				yield* Deferred.await(held);
				release = Deferred.succeed(released, undefined).pipe(Effect.andThen(Fiber.join(holder)));
			}),
		releaseReceiptUpdates: () => release ?? Effect.die(new Error("Receipt updates are not held")),
		untilCopiesWaitOn: (...events: readonly string[]) =>
			waitingCopies.pipe(
				Effect.flatMap((rows) => {
					const waits = rows.map(({ waitEvent }) => waitEvent);
					return JSON.stringify(waits) === JSON.stringify(events)
						? Effect.void
						: Effect.fail(new Error(`Copies wait on [${waits.join(", ")}], not [${events.join(", ")}]`));
				}),
				Effect.retry({ schedule: Schedule.spaced("10 millis"), times: 500 }),
				Effect.orDie,
			),
	};
}
