import { Effect, Exit } from "effect";
import { publicFailure } from "#test/publicFailure.ts";
import type { QueryControl } from "#test/queryControls.ts";
import type { RuntimeControls } from "#test/runtimeControls.ts";
import { Database } from "#test/sqlite/database.ts";
import { transactionCoordination } from "#test/transactionCoordination.ts";
import { withTestTransaction } from "#testing/transaction.ts";

export function transactionProbes(db: Effect.Success<typeof Database>, controls: RuntimeControls, state: () => QueryControl) {
	const settle = Effect.fnUntraced(function* (mode: "commit" | "rollback" | "test") {
		let escaped: Effect.Success<typeof Database> | undefined;
		const program = Effect.gen(function* () {
			escaped = yield* Database;
			yield* escaped.User.count();
			if (mode === "rollback") {
				yield* Effect.fail("expected");
			}
		});
		const exit = yield* Effect.exit(mode === "test" ? withTestTransaction(Database, program) : db.transaction(program));
		if (escaped === undefined) {
			throw new Error("The transaction did not start");
		}
		const closed = yield* Effect.exit(escaped.User.count());
		const closedReason = publicFailure(closed).reason;
		if (closedReason._tag !== "PrismaRuntimeFailure" || closedReason.code !== "RUNTIME.TRANSACTION_CLOSED") {
			throw new Error("Escaped transaction must fail closed");
		}
		return {
			calls: [...controls.calls],
			open: Exit.isSuccess(closed),
			reason: Object.keys(controls.faults).length > 0 ? publicFailure(exit).reason : undefined,
		};
	});
	return {
		...transactionCoordination(db, controls, state),
		commit: () => settle("commit"),
		commitFailure: () => settle("commit"),
		releaseFailure: () => settle("commit"),
		rollback: () => settle("rollback"),
		rollbackFailure: () => settle("rollback"),
		testRollback: () => settle("test"),
	};
}
