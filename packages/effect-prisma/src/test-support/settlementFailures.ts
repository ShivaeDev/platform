import { Effect } from "effect";
import { settleConnection } from "#internal/adapters/transaction-settlement.ts";
import { failedSettlement } from "#test/failedSettlement.ts";

export function settlementFailures() {
	const commitError = new Error("COMMIT connection reset");
	const releaseError = new Error("connection already terminated");
	const resource = failedSettlement(commitError, releaseError);
	return Effect.promise(async () => {
		const error = await settleConnection(resource, true).then(
			() => undefined,
			(failure: unknown) => failure,
		);
		return { calls: resource.calls, error, unexpected: resource.unexpected };
	});
}
