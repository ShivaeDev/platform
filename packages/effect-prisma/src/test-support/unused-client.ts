import type { AnySqlContract, SqlDatabaseClient } from "#internal/executor.ts";

const unavailable = (member: string): never => {
	throw new TypeError(`The test client has no ${member}`);
};

export const unusedClient = <Contract extends AnySqlContract = AnySqlContract>(): SqlDatabaseClient<Contract> => ({
	close: () => Promise.resolve(),
	get context() {
		return unavailable("context");
	},
	get contract() {
		return unavailable("contract");
	},
	runtime: () => unavailable("runtime"),
});
