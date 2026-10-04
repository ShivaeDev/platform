import { NodeServices } from "@effect/platform-node";
import * as SqliteClient from "@effect/sql-sqlite-node/SqliteClient";
import { Effect, Layer } from "effect";
import { Reactivity } from "effect/unstable/reactivity";
import { canonicalPath } from "./paths.ts";
import { failure } from "./ports.ts";
export function databaseLayer(filename: string) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const canonical =
				filename === ":memory:" ? filename : yield* canonicalPath(filename).pipe(Effect.mapError(() => failure("Cannot resolve the database path")));
			if (canonical !== ":memory:") {
				const lock = yield* SqliteClient.make({ busyTimeout: 0, "disableWAL": true, filename: `${canonical}.lock` });
				yield* lock
					.unsafe("BEGIN EXCLUSIVE")
					.pipe(Effect.mapError(() => failure("Another fleet process owns this database. Stop it before using a mutating command.")));
				yield* Effect.addFinalizer(() => lock.unsafe("ROLLBACK").pipe(Effect.orDie));
			}
			return SqliteClient.layer({ busyTimeout: 0, filename: canonical });
		}),
	).pipe(Layer.provide(Reactivity.layer), Layer.provide(NodeServices.layer));
}
