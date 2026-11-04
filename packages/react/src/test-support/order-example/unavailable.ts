import { StorageUnavailable } from "./contract.ts";

export function unavailable() {
	return new StorageUnavailable();
}
