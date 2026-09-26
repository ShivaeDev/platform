import type { AnySqlContract, SqlDatabaseClient } from "../../src/internal/executor.ts";

const unavailable = (member: string): never => {
	throw new TypeError(`The test client has no ${member}`);
};

export const unusedClient = <Contract extends AnySqlContract = AnySqlContract>(): SqlDatabaseClient<Contract> => ({
	get contract() {
		return unavailable("contract");
	},
	get context() {
		return unavailable("context");
	},
	runtime: () => unavailable("runtime"),
	close: () => Promise.resolve(),
});
