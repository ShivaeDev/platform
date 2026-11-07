import { Unavailable } from "#test/postgres-example/contract.ts";

export function unavailable() {
	return new Unavailable();
}
