import process from "node:process";
import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Redacted } from "effect";
import * as Reactivity from "effect/reactivity/Reactivity";

await Effect.runPromise(
	Effect.gen(function* () {
		const sql = yield* PgClient.makeClient({ url: Redacted.make(yield* Config.String("DATABASE_URL")) });
		const key = yield* Config.String("LOCK_KEY");
		const [session] = yield* sql<{ pid: number }>`select pg_backend_pid() as pid`;
		process.send?.(session?.pid);
		yield* Effect.callback<void>((resume) => {
			process.once("message", () => resume(Effect.void));
		});
		yield* sql`select pg_advisory_lock(hashtextextended(${key}, 0))`;
		yield* Effect.never;
	}).pipe(Effect.scoped, Effect.provide(Reactivity.layer)),
);
