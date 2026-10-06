import type { SettledConnection, SettledTransaction } from "#internal/adapters/transaction-settlement.ts";

export function failedSettlement(commitError: Error, releaseError: Error) {
	const calls: string[] = [];
	const unexpected: string[] = [];
	const expected = ["commit", "rollback", "release", "destroy"];
	function record(call: string): void {
		const next = expected[calls.length];
		calls.push(call);
		if (call !== next) {
			unexpected.push(call);
			throw new Error(`Unexpected transaction settlement call ${call}, expected ${next}`);
		}
	}
	const connection: SettledConnection = {
		destroy: (reason) => {
			record("destroy");
			if (reason !== releaseError) {
				unexpected.push("destroy reason");
				throw new Error("Transaction disposal must preserve the connection release error");
			}
			return Promise.resolve();
		},
		release: () => {
			record("release");
			return Promise.reject(releaseError);
		},
	};
	const transaction: SettledTransaction = {
		commit: () => {
			record("commit");
			return Promise.reject(commitError);
		},
		rollback: () => Promise.resolve(record("rollback")),
	};
	return { calls, connection, transaction, unexpected };
}
