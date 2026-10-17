import { Effect, Exit } from "effect";
import { releaseTestTransaction, releaseTransaction } from "#internal/transaction.ts";
import { makeTransactionResource, type ResourceOptions } from "#test/makeTransactionResource.ts";
import { transactionCoordination } from "#test/transactionCoordination.ts";

const settle = Effect.fnUntraced(function* (mode: "commit" | "rollback" | "test", options: ResourceOptions = {}, fails = false) {
	const { calls, resource } = makeTransactionResource(options);
	const release = mode === "test" ? releaseTestTransaction : releaseTransaction;
	const effect = release(resource, mode === "rollback" ? Exit.fail("expected") : Exit.succeed(undefined));
	const error = yield* fails ? Effect.flip(effect) : Effect.as(effect, undefined);
	return { calls, open: resource.executor.liveness.open, reason: error?.reason };
});

export function transactionProbes() {
	return {
		...transactionCoordination(),
		commit: () => settle("commit"),
		commitFailure: () => settle("commit", { commitFailure: new Error("commit failed") }, true),
		releaseFailure: () => settle("commit", { releaseFailure: { code: "RUNTIME.CONNECTION_RELEASE_FAILED" } }, true),
		rollback: () => settle("rollback"),
		rollbackFailure: () => settle("rollback", { rollbackFailure: new Error("rollback failed") }, true),
		testRollback: () => settle("test"),
	};
}
