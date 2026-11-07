import { StorageUnavailable } from "#test/order-example/contract.ts";

export function unavailable() {
	return new StorageUnavailable();
}
