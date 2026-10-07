import type { AnySqlContract, SqlDatabaseClient } from "#internal/executor.ts";

function unavailable(member: string): never {
	throw new TypeError(`The test client has no ${member}`);
}

export function unusedClient<Contract extends AnySqlContract = AnySqlContract>(): SqlDatabaseClient<Contract> {
	return {
		close: () => Promise.resolve(),
		get context() {
			return unavailable("context");
		},
		get contract() {
			return unavailable("contract");
		},
		runtime: () => unavailable("runtime"),
	};
}
