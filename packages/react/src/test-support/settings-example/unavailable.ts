import { Unavailable } from "./contract.ts";

export function unavailable() {
	return new Unavailable();
}
