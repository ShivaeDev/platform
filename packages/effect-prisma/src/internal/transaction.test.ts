import { expect } from "vitest";
import { controlledUsers } from "#test/queryControls.ts";
import { controlsQueries, failsSettlement, hasUsers, holdsSettlement, sqliteStory } from "#test/sqlite/story.ts";

sqliteStory.it("commits and releases a successful transaction", [], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.commit();
	expect(result.calls).toEqual(["commit", "release"]);
	expect(result.open).toBe(false);
});

sqliteStory.it("rolls back and releases a failed transaction", [], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.rollback();
	expect(result.calls).toEqual(["rollback", "release"]);
	expect(result.open).toBe(false);
});

sqliteStory.it("forces rollback for a successful test transaction", [], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.testRollback();
	expect(result.calls).toEqual(["rollback", "release"]);
	expect(result.open).toBe(false);
});

sqliteStory.it("reports commit failure after attempting rollback and release", [failsSettlement("commit")], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.commitFailure();
	expect(result.calls).toEqual(["commit", "rollback", "release"]);
	expect(result.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.TRANSACTION_COMMIT_FAILED",
	});
	expect(result.open).toBe(false);
});

sqliteStory.it("destroys the connection when rollback fails", [failsSettlement("rollback")], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.rollbackFailure();
	expect(result.calls).toEqual(["rollback", "destroy"]);
	expect(result.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.TRANSACTION_ROLLBACK_FAILED",
	});
	expect(result.open).toBe(false);
});

sqliteStory.it("destroys the connection when release fails", [failsSettlement("release")], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.releaseFailure();
	expect(result.calls).toEqual(["commit", "release", "destroy"]);
	expect(result.reason).toMatchObject({
		_tag: "PrismaRuntimeFailure",
		code: "RUNTIME.CONNECTION_RELEASE_FAILED",
	});
	expect(result.open).toBe(false);
});

sqliteStory.it(
	"drains the active query and refuses queued work before settlement",
	[hasUsers(controlledUsers), controlsQueries("drain")],
	function* ({ transactionProbes }) {
		const result = yield* transactionProbes.drain();
		expect(result.whileQueryRuns).toEqual(["query1"]);
		expect(result.queuedError).toMatchObject({
			_tag: "PrismaRuntimeFailure",
			code: "RUNTIME.TRANSACTION_CLOSED",
		});
		expect(result.calls).toEqual(["query1", "queued:RUNTIME.TRANSACTION_CLOSED", "commit", "release"]);
	},
);

sqliteStory.it("holds the transaction permit through interrupted settlement", [holdsSettlement()], function* ({ transactionProbes }) {
	const result = yield* transactionProbes.interruptPermit();
	expect(result.beforeInterruption).toBe(false);
	expect(result.duringSettlement).toBe(false);
	expect(result.afterSettlement).toBe(true);
});
