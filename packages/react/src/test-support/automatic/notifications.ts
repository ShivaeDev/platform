import { createHash } from "node:crypto";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Deferred, Effect, Queue, Redacted } from "effect";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";

export const notifications = Effect.gen(function* () {
	const database = yield* PostgresTestDatabase;
	const name = yield* Config.String("APP_NAME").pipe(Config.withDefault(new URL(Redacted.value(database.url)).pathname));
	const channel = `changes_${createHash("sha256").update(name).digest("hex").slice(0, 32)}`;
	const pg = yield* PgClient.PgClient;
	const incoming = yield* pg.listen(channel);
	const received: string[] = [];
	const barriers = new Map<string, Deferred.Deferred<void>>();
	yield* Effect.forever(
		Queue.take(incoming).pipe(
			Effect.tap((message) =>
				Effect.sync(() => {
					const barrier = barriers.get(message.payload);
					if (barrier) {
						Deferred.doneUnsafe(barrier, Effect.void);
					} else if (message.payload.startsWith("[")) {
						received.push(message.payload);
					}
				}),
			),
		),
	).pipe(Effect.forkScoped);
	const delivered = Effect.gen(function* () {
		const payload = `barrier ${barriers.size}`;
		const barrier = Deferred.makeUnsafe<void>();
		barriers.set(payload, barrier);
		yield* pg.notify(channel, payload).pipe(Effect.orDie);
		yield* Deferred.await(barrier);
		return received.map((notification): unknown => JSON.parse(notification));
	});
	return delivered;
});
