import { Semaphore } from "effect";
import type { AnySqlContract } from "#internal/executor.ts";
import type { TransactionResource } from "#internal/transaction.ts";
import { unusedClient } from "#test/unused-client.ts";

export interface ResourceOptions {
	readonly commitFailure?: unknown;
	readonly releaseFailure?: unknown;
	readonly rollbackFailure?: unknown;
}

export function makeTransactionResource(options: ResourceOptions = {}) {
	const calls: string[] = [];
	function perform(call: string, failure?: unknown) {
		calls.push(call);
		return failure === undefined ? Promise.resolve() : Promise.reject(failure);
	}
	const resource: TransactionResource<Record<string, never>, AnySqlContract> = {
		connection: { destroy: () => perform("destroy"), release: () => perform("release", options.releaseFailure) },
		executor: {
			client: unusedClient(),
			identity: {},
			liveness: { closedCode: "RUNTIME.TRANSACTION_CLOSED", open: true },
			mode: "transaction",
			models: {},
			querySemaphore: Semaphore.makeUnsafe(1),
			transactionIdentity: {},
			transactionSemaphore: undefined,
		},
		transaction: { commit: () => perform("commit", options.commitFailure), rollback: () => perform("rollback", options.rollbackFailure) },
	};
	return { calls, resource };
}
