import { Effect, Redacted } from "effect";
import { publicFailure } from "#test/publicFailure.ts";
import type { RuntimeControls } from "#test/runtimeControls.ts";
import { Database } from "#test/sqlite/database.ts";

export const settlementFailures = Effect.fnUntraced(function* (db: Effect.Success<typeof Database>, controls: RuntimeControls) {
	const exit = yield* Effect.exit(
		db.transaction(
			Effect.gen(function* () {
				const transaction = yield* Database;
				yield* transaction.User.count();
			}),
		),
	);
	const error = Redacted.value(publicFailure(exit).reason.original);
	return { calls: controls.calls, error, unexpected: controls.destroyReasons.filter((reason) => reason !== controls.faults.release) };
});
