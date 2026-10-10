import { expect, it } from "vitest";
import { settleConnection } from "#internal/adapters/transaction-settlement.ts";
import { failedSettlement } from "#test/failedSettlement.ts";

it("preserves commit and connection release failures when settlement loses its connection", async () => {
	const commitError = new Error("COMMIT connection reset");
	const releaseError = new Error("connection already terminated");
	const resource = failedSettlement(commitError, releaseError);

	await expect(settleConnection(resource, true)).rejects.toMatchObject({
		cause: { cause: commitError, code: "RUNTIME.TRANSACTION_COMMIT_FAILED" },
		code: "RUNTIME.TRANSACTION_RELEASE_FAILED",
		releaseError,
	});
	expect(resource.calls).toEqual(["commit", "rollback", "release", "destroy"]);
	expect(resource.unexpected).toEqual([]);
});
